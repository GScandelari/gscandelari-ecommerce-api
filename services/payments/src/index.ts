import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

/**
 * Entry point da Cloud Function HTTPS 2a geracao do servico Payments
 * (codebase `payments`, Fase 3). `secrets` injeta STRIPE_SECRET_KEY/
 * STRIPE_WEBHOOK_SECRET do Firebase Secret Manager em producao. O ID do
 * export ("payments-api") e usado pelo rewrite do API Gateway (RN20).
 *
 * Fase 5/Epico 8.6: `serviceAccount` roda a function com a SA dedicada de
 * menor privilegio (`payments-runtime@...`, Task 9.1.3/9.1.4) em vez da SA
 * default do Compute Engine - lida de env var pra nao quebrar o emulador
 * local (onde a var nao existe e a opcao fica undefined, sem efeito).
 */
const paymentsApi = onRequest(
  {
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    serviceAccount: process.env.RUNTIME_SERVICE_ACCOUNT_EMAIL,
  },
  app,
);
export { paymentsApi as "payments-api" };
