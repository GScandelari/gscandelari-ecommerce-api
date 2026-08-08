import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

/**
 * Entry point da Cloud Function HTTPS 2a geracao do servico Orders
 * (codebase `orders`, Fase 3). Nao precisa de nenhum secret do Stripe -
 * Orders nao fala mais com o Stripe diretamente (RN16, chamada HTTP
 * interna a Payments). O ID do export ("orders-api") e usado pelo rewrite
 * do API Gateway (RN20, firebase.json > hosting.rewrites).
 *
 * Fase 5/Epico 8.6: `serviceAccount` roda a function com a SA dedicada de
 * menor privilegio (`orders-runtime@...`, Task 9.1.3/9.1.4) em vez da SA
 * default do Compute Engine - lida de env var pra nao quebrar o emulador
 * local (onde a var nao existe e a opcao fica undefined, sem efeito).
 */
const ordersApi = onRequest({ serviceAccount: process.env.RUNTIME_SERVICE_ACCOUNT_EMAIL }, app);
export { ordersApi as "orders-api" };
