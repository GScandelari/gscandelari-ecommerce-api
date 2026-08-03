import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

/**
 * Entry point da Cloud Function HTTPS 2a geracao do servico Payments
 * (codebase `payments`, Fase 3). `secrets` injeta STRIPE_SECRET_KEY/
 * STRIPE_WEBHOOK_SECRET do Firebase Secret Manager em producao. O ID do
 * export ("payments-api") e usado pelo rewrite do API Gateway (RN20).
 */
const paymentsApi = onRequest({ secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] }, app);
export { paymentsApi as "payments-api" };
