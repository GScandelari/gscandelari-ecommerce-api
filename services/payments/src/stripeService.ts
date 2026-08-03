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
export async function criarPaymentIntent(pedidoId: string, total: number): Promise<CriarPaymentIntentResult> {
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
