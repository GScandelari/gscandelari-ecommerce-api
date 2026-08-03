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

    let event;
    try {
      event = getStripeClient().webhooks.constructEvent(
        req.body,
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
