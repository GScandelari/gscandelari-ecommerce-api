import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

/**
 * Entry point da Cloud Function HTTPS 2a geracao (Task 1.1.2 / 1.2.2).
 * Nao e exercitado pelos testes de integracao do Modulo 3 (que importam
 * `./app` diretamente via Supertest, sem subir o Functions emulator -
 * ver Task 3.1.2), mas mantem `firebase.json` valido para quem rodar
 * `firebase emulators:start` com todos os emuladores.
 *
 * Fase 2: `secrets` injeta STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET do
 * Firebase Secret Manager em `process.env` em producao (ver README.md >
 * "Integracao de pagamento (Stripe)"). Nao tem efeito no emulator, que
 * usa o .env local (ver .env.example).
 */
export const api = onRequest({ secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] }, app);
