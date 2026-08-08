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
 *
 * IMPORTANTE: exportar como identificador simples `api` (nao como
 * `export { x as "payments-api" }`) - o Firebase ja prefixa
 * automaticamente pelo nome do codebase (Task 8.5.2), produzindo
 * "payments-api" no deploy. Um nome de export literal com hifen quebra a
 * resolucao de entry_point do Cloud Functions real ("Function nao
 * definida no modulo") - bug so visivel no deploy real, nunca no
 * emulador (que resolve exports por introspeccao direta, sem essa etapa).
 */
export const api = onRequest(
  {
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    serviceAccount: process.env.RUNTIME_SERVICE_ACCOUNT_EMAIL,
  },
  app,
);
