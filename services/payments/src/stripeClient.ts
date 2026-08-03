import Stripe from "stripe";

let client: Stripe | undefined;

/**
 * Singleton do SDK do Stripe (mesmo padrao de firebaseAdmin.ts). Sempre
 * usado em modo TESTE/sandbox neste projeto - STRIPE_SECRET_KEY deve ser
 * uma chave sk_test_..., nunca sk_live_... (ver README.md).
 */
export function getStripeClient(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY nao configurada.");
    }
    client = new Stripe(secretKey);
  }
  return client;
}
