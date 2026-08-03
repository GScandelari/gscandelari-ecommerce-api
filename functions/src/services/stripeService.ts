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
