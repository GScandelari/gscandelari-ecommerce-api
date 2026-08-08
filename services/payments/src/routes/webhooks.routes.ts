import express, { Router } from "express";
import { getStripeClient } from "@/stripeClient";
import { ValidationError } from "@/errors";
import { asyncHandler } from "@/utils/asyncHandler";
import { jaProcessado, registrarEventoProcessado } from "@/repositories/stripeEventsRepository";
import {
  cancelarPedidoPorFalhaPagamento,
  confirmarPagamentoPedido,
} from "@/services/orders.internalClient";

interface StripeEventObjectComMetadata {
  id: string;
  metadata?: Record<string, string>;
}

const router = Router();

// RN11 (herdada da Fase 2): rota publica, sem `authenticate`/`verifyInternalToken`
// - a autorizacao aqui e a assinatura do Stripe. Precisa do corpo CRU
// (Buffer) para stripe.webhooks.constructEvent validar a assinatura.
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature || typeof signature !== "string") {
      throw new ValidationError("Assinatura do webhook (stripe-signature) ausente.");
    }

    // O Firebase Functions Framework (onRequest, 2a geracao) sempre faz seu
    // proprio parse do corpo da requisicao ANTES de repassar para o app
    // Express - por isso `req.body` chega como objeto ja parseado mesmo com
    // express.raw() montado nesta rota. O corpo cru fica em `req.rawBody`
    // (Buffer), populado automaticamente pelo framework. Em testes
    // (Supertest direto contra o app Express) `req.rawBody` nao existe e
    // `req.body` continua sendo o Buffer setado por express.raw() - por
    // isso o fallback abaixo funciona nos dois ambientes. Bug real
    // encontrado na Fase 4 testando o front-end contra o Emulator Suite de
    // ponta a ponta com o Stripe CLI (nunca pego pelos testes, que exercitam
    // o app Express puro, sem o wrapper do Functions Framework) - mesma
    // correcao aplicada em functions/src/routes/webhooks.routes.ts (Fase 2).
    const payload = (req as express.Request & { rawBody?: Buffer }).rawBody ?? req.body;

    let event;
    try {
      event = getStripeClient().webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET ?? "",
      );
    } catch {
      throw new ValidationError("Assinatura do webhook invalida.");
    }

    // RN14: idempotencia - reentrega do mesmo event.id nao reprocessa (e,
    // na Fase 3, nem chega a chamar Orders de novo).
    if (await jaProcessado(event.id)) {
      res.status(200).json({ received: true, deduplicated: true });
      return;
    }

    const eventObject = event.data.object as unknown as StripeEventObjectComMetadata;
    const pedidoId = eventObject.metadata?.pedidoId;

    // RN17: efeito de dominio via chamada HTTP interna a Orders - se essa
    // chamada falhar, a excecao propaga (sem capturar aqui), o webhook
    // responde 5xx ao Stripe, e registrarEventoProcessado abaixo NUNCA e
    // chamado - permite reentrega nativa do Stripe (Decisao tecnica 6).
    if (pedidoId) {
      if (event.type === "payment_intent.succeeded") {
        await confirmarPagamentoPedido(pedidoId);
      } else if (
        event.type === "payment_intent.payment_failed" ||
        event.type === "payment_intent.canceled"
      ) {
        await cancelarPedidoPorFalhaPagamento(pedidoId);
      }
    }
    // Tipos de evento fora do mapeamento acima (ou sem metadata.pedidoId)
    // sao aceitos sem efeito de dominio (RN15 / Task 6.4.5, herdada da Fase 2).

    await registrarEventoProcessado(event.id, event.type);
    res.status(200).json({ received: true });
  }),
);

export default router;
