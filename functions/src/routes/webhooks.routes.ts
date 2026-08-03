import express, { Router } from "express";
import { getStripeClient } from "@/stripeClient";
import { ValidationError } from "@/errors";
import { asyncHandler } from "@/utils/asyncHandler";
import { jaProcessado, registrarEventoProcessado } from "@/repositories/stripeEventsRepository";
import {
  cancelarPedidoPorFalhaPagamento,
  confirmarPagamentoPedido,
} from "@/services/pedidosService";

interface StripeEventObjectComMetadata {
  id: string;
  metadata?: Record<string, string>;
}

const router = Router();

// RN11: rota publica (sem `authenticate` - a autorizacao aqui e a
// assinatura do Stripe, nao um Firebase ID Token). Precisa do corpo CRU
// (Buffer) para stripe.webhooks.constructEvent validar a assinatura -
// Task 6.1.1: por isso usa express.raw() em vez do express.json() global.
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature || typeof signature !== "string") {
      throw new ValidationError("Assinatura do webhook (stripe-signature) ausente.");
    }

    // Nao valida STRIPE_WEBHOOK_SECRET aqui: o proprio constructEvent (real
    // ou mockado nos testes) e a fonte de verdade - se o secret estiver
    // ausente/errado, o SDK real ja rejeita a assinatura, caindo no catch
    // abaixo como 400, sem duplicar essa logica na rota.
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

    // RN14: idempotencia - reentrega do mesmo event.id nao reprocessa.
    if (await jaProcessado(event.id)) {
      res.status(200).json({ received: true, deduplicated: true });
      return;
    }

    const eventObject = event.data.object as unknown as StripeEventObjectComMetadata;
    const pedidoId = eventObject.metadata?.pedidoId;

    if (pedidoId) {
      if (event.type === "payment_intent.succeeded") {
        // RN12 (noop se fora de `pendente` ou inexistente - RN15).
        await confirmarPagamentoPedido(pedidoId);
      } else if (
        event.type === "payment_intent.payment_failed" ||
        event.type === "payment_intent.canceled"
      ) {
        // RN13 (noop se fora de `pendente` ou inexistente - RN15).
        await cancelarPedidoPorFalhaPagamento(pedidoId);
      }
    }
    // Task 6.4.5: tipos de evento fora do mapeamento acima (ou sem
    // metadata.pedidoId) sao aceitos sem efeito de dominio.

    await registrarEventoProcessado(event.id, event.type);
    res.status(200).json({ received: true });
  }),
);

export default router;
