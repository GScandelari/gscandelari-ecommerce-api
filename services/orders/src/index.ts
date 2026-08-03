import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

/**
 * Entry point da Cloud Function HTTPS 2a geracao do servico Orders
 * (codebase `orders`, Fase 3). Nao precisa de nenhum secret do Stripe -
 * Orders nao fala mais com o Stripe diretamente (RN16, chamada HTTP
 * interna a Payments). O ID do export ("orders-api") e usado pelo rewrite
 * do API Gateway (RN20, firebase.json > hosting.rewrites).
 */
const ordersApi = onRequest(app);
export { ordersApi as "orders-api" };
