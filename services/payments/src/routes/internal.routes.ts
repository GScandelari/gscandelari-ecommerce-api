import { Router } from "express";
import { verifyInternalToken } from "@/middlewares/verifyInternalToken";
import { asyncHandler } from "@/utils/asyncHandler";
import { PaymentGatewayError, ValidationError } from "@/errors";
import { criarPaymentIntent, reembolsarPagamento } from "@/stripeService";

const router = Router();

router.use(verifyInternalToken);

// RN16: chamado por Orders na criacao do pedido. Contrato reduzido a
// {pedidoId, total} (Decisao tecnica 3, Fase 3) - validacao manual simples,
// sem puxar Zod so para este unico endpoint interno.
router.post(
  "/payment-intents",
  asyncHandler(async (req, res) => {
    const { pedidoId, total } = req.body ?? {};
    if (
      typeof pedidoId !== "string" ||
      pedidoId.length === 0 ||
      typeof total !== "number" ||
      total <= 0
    ) {
      throw new ValidationError(
        "Payload invalido: esperado { pedidoId: string, total: number > 0 }.",
      );
    }

    try {
      const { paymentIntentId, clientSecret } = await criarPaymentIntent(pedidoId, total);
      res.status(200).json({ paymentIntentId, clientSecret });
    } catch {
      throw new PaymentGatewayError("Nao foi possivel criar a PaymentIntent no Stripe.");
    }
  }),
);

// RN32 (Fase 5): chamado por Orders (`reembolsarPedido`) - mesma fronteira
// de RN16, Orders nunca fala com o Stripe diretamente.
router.post(
  "/refunds",
  asyncHandler(async (req, res) => {
    const { paymentIntentId, amount } = req.body ?? {};
    if (
      typeof paymentIntentId !== "string" ||
      paymentIntentId.length === 0 ||
      typeof amount !== "number" ||
      amount <= 0
    ) {
      throw new ValidationError(
        "Payload invalido: esperado { paymentIntentId: string, amount: number > 0 }.",
      );
    }

    try {
      await reembolsarPagamento(paymentIntentId, amount);
      res.status(200).json({ received: true });
    } catch {
      throw new PaymentGatewayError("Nao foi possivel processar o reembolso junto ao Stripe.");
    }
  }),
);

export default router;
