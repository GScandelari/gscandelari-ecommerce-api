import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

/**
 * Entry point da Cloud Function HTTPS 2a geracao do servico Orders
 * (codebase `orders`, Fase 3). Nao precisa de nenhum secret do Stripe -
 * Orders nao fala mais com o Stripe diretamente (RN16, chamada HTTP
 * interna a Payments). O ID do export ("ordersApi") e usado pelo rewrite
 * do API Gateway (RN20, firebase.json > hosting.rewrites).
 *
 * Fase 5/Epico 8.6: `serviceAccount` roda a function com a SA dedicada de
 * menor privilegio (`orders-runtime@...`, Task 9.1.3/9.1.4) em vez da SA
 * default do Compute Engine - lida de env var pra nao quebrar o emulador
 * local (onde a var nao existe e a opcao fica undefined, sem efeito).
 *
 * IMPORTANTE (2 bugs reais encontrados no primeiro deploy real, nunca
 * pegos pelo emulador): (1) `export { x as "orders-api" }` (nome de
 * export string-literal) quebra a resolucao de entry_point do Cloud
 * Functions real - precisa ser um identificador JS valido. (2) Codebases
 * diferentes NAO tem namespace proprio pro ID da function - "Firebase
 * prefixa automaticamente pelo nome do codebase" (Task 8.5.2 do
 * BACKLOG.md) estava errado, nunca verificado contra deploy real: dois
 * codebases exportando `api` colidem ("More than one codebase claims...
 * functions/api"). O ID final e literalmente o nome do identificador
 * exportado - por isso `ordersApi`/`paymentsApi` (camelCase, sem hifen,
 * unicos entre codebases) em vez de `api`.
 */
export const ordersApi = onRequest(
  { serviceAccount: process.env.RUNTIME_SERVICE_ACCOUNT_EMAIL },
  app,
);
