import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import app from "./app";

/**
 * Entry point da Cloud Function HTTPS 2a geracao do servico Payments
 * (codebase `payments`, Fase 3). `secrets` injeta STRIPE_SECRET_KEY/
 * STRIPE_WEBHOOK_SECRET do Firebase Secret Manager em producao. O ID do
 * export ("paymentsApi") e usado pelo rewrite do API Gateway (RN20).
 *
 * Fase 5/Epico 8.6: `serviceAccount` roda a function com a SA dedicada de
 * menor privilegio (`payments-runtime@...`, Task 9.1.3/9.1.4) em vez da SA
 * default do Compute Engine.
 *
 * IMPORTANTE (3 bugs reais encontrados nos primeiros deploys reais, nunca
 * pegos pelo emulador nem pelos testes Jest/Supertest): (1) `export { x as
 * "payments-api" }` (nome de export string-literal) quebra a resolucao de
 * entry_point do Cloud Functions real - precisa ser um identificador JS
 * valido. (2) Codebases diferentes NAO tem namespace proprio pro ID da
 * function - "Firebase prefixa automaticamente pelo nome do codebase"
 * (Task 8.5.2 do BACKLOG.md) estava errado, nunca verificado contra deploy
 * real: dois codebases exportando `api` colidem ("More than one codebase
 * claims... functions/api"). O ID final e literalmente o nome do
 * identificador exportado - por isso `ordersApi`/`paymentsApi` (camelCase,
 * sem hifen, unicos entre codebases) em vez de `api`. (3) `process.env.X`
 * lido direto no literal de opcoes do `onRequest()` (ex.:
 * `serviceAccount: process.env.RUNTIME_SERVICE_ACCOUNT_EMAIL`) SEMPRE
 * resolve como `undefined` num deploy real - o Firebase CLI faz o
 * `require()` do codebase pra descobrir as functions (avaliando esse
 * literal de opcoes) ANTES de carregar o `.env.<project-id>` em
 * `process.env` (esse `.env` so e injetado depois, numa fase seguinte,
 * exclusivamente pro runtime da function). O `serviceAccount` acabava
 * sempre undefined e a function era deployada com a SA default do Compute
 * Engine, sem nenhum erro (silencioso). Fix correto: a API de
 * "Parameterized Configuration" do firebase-functions v2 (`defineString`),
 * que devolve uma `Expression<string>` resolvida numa fase posterior do
 * deploy (depois do `.env` ja carregado) - unico jeito documentado de ler
 * `.env.<project-id>` em opcoes de build-time como `serviceAccount`.
 */
const runtimeServiceAccountEmail = defineString("RUNTIME_SERVICE_ACCOUNT_EMAIL", {
  default: "",
});

export const paymentsApi = onRequest(
  {
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    serviceAccount: runtimeServiceAccountEmail,
  },
  app,
);
