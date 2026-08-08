import { getStripeClient } from "@/stripeClient";

export interface CriarPaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
}

/**
 * RN16 (Decisao tecnica 3, Fase 3): contrato reduzido a (pedidoId, total) -
 * Payments nao conhece mais o tipo `Pedido` completo (isso continua sendo
 * responsabilidade exclusiva de Orders).
 */
export async function criarPaymentIntent(
  pedidoId: string,
  total: number,
): Promise<CriarPaymentIntentResult> {
  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100),
    currency: "brl",
    metadata: { pedidoId },
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret as string,
  };
}

/**
 * RN32 (Fase 5): estorno total via Stripe, chamado pelo endpoint interno
 * `POST /internal/refunds` (Orders e o unico chamador, via
 * `payments.internalClient.ts`). Mesmo contrato reduzido ja usado para
 * `criarPaymentIntent` - Payments nao conhece o tipo `Pedido`, so
 * `paymentIntentId`/`amount` (em centavos, calculado por Orders a partir de
 * `pedido.total`).
 */
export async function reembolsarPagamento(paymentIntentId: string, amount: number): Promise<void> {
  const stripe = getStripeClient();
  await stripe.refunds.create({ payment_intent: paymentIntentId, amount });
}
