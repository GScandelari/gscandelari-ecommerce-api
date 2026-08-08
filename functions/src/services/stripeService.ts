import { getStripeClient } from "@/stripeClient";
import { Pedido } from "@/models/pedido";

export interface CriarPaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
}

/**
 * RN10: traduz um Pedido ja persistido numa PaymentIntent do Stripe pelo
 * valor total (em centavos), com metadata.pedidoId para o webhook (RN11+)
 * conseguir localizar o pedido correspondente.
 */
export async function criarPaymentIntent(pedido: Pedido): Promise<CriarPaymentIntentResult> {
  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(pedido.total * 100),
    currency: "brl",
    metadata: { pedidoId: pedido.id },
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret as string,
  };
}

/**
 * RN32 (Fase 5): solicita o estorno total de um Pedido ja cobrado junto ao
 * Stripe. Valor explicito em centavos (mesmo padrao de `criarPaymentIntent`)
 * em vez de omitir `amount` (que estornaria o valor implicito ja capturado
 * na PaymentIntent) - mantem o comportamento determinístico e testavel com
 * o SDK mockado. Sem reembolso parcial nesta fase.
 */
export async function reembolsarPagamento(pedido: Pedido): Promise<void> {
  const stripe = getStripeClient();
  await stripe.refunds.create({
    payment_intent: pedido.paymentIntentId as string,
    amount: Math.round(pedido.total * 100),
  });
}
