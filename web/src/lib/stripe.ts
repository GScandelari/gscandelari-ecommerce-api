import { loadStripe, type Stripe } from "@stripe/stripe-js";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

// Task 15.2.1: falha explicita e logada (nao silenciosa) se a chave nao
// estiver configurada - sem isso, `confirmCardPayment` falharia mais tarde
// com um erro dificil de rastrear ate aqui.
if (!publishableKey) {
  throw new Error(
    "VITE_STRIPE_PUBLISHABLE_KEY nao definida. Configure web/.env com uma chave pk_test_... " +
      "(Stripe em modo sandbox) antes de abrir o checkout.",
  );
}

export const stripePromise: Promise<Stripe | null> = loadStripe(publishableKey);
