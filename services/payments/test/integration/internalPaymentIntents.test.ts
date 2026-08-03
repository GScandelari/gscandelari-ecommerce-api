// Estes imports DEVEM vir antes de `../../src/app` para que os mocks
// virtuais/reais sejam registrados antes de qualquer `require` real do
// cliente Stripe ou da `google-auth-library`.
import { mockPaymentIntentsCreate, resetStripeMocks } from "../helpers/mockStripe";
import { mockVerifyIdToken, resetGoogleAuthLibraryMocks } from "../helpers/mockGoogleAuthLibrary";
import request from "supertest";
import app from "../../src/app";

/**
 * Testes de integracao de `POST /internal/payment-intents` (Payments) -
 * RN16, RN18 (Modulo 9 - Epico 9.2 - Task 9.2.1, Modulo 12 - Task 12.2.4).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): `services/payments/src/app.ts` e a
 * rota `POST /internal/payment-intents` (Task 9.2.1) AINDA NAO EXISTEM.
 *
 * Contrato (Decisao tecnica 3 do BACKLOG - Fase 3): recebe
 * `{ pedidoId: string, total: number }`, retorna
 * `{ paymentIntentId, clientSecret }` - Payments nao conhece mais o tipo
 * `Pedido` completo.
 */

const SELF_URL = "https://payments-api-xyz.a.run.app";
const CALLER_EMAIL = "orders-runtime@demo-gscandelari-ecommerce-api.iam.gserviceaccount.com";

describe("POST /internal/payment-intents (Payments) - RN16, RN18 (Task 9.2.1 / 12.2.4)", () => {
  beforeEach(() => {
    resetStripeMocks();
    resetGoogleAuthLibraryMocks();
    process.env.SELF_BASE_URL = SELF_URL;
    process.env.ALLOWED_CALLER_SERVICE_ACCOUNT_EMAIL = CALLER_EMAIL;
  });

  // Task 12.2.4
  it("RN18: sem header Authorization -> 401, Stripe nunca chamado", async () => {
    const res = await request(app)
      .post("/internal/payment-intents")
      .send({ pedidoId: "p1", total: 10 });

    expect(res.status).toBe(401);
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
  });

  it("RN18: token interno com assinatura invalida -> 401, Stripe nunca chamado", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("assinatura invalida (simulado)"));

    const res = await request(app)
      .post("/internal/payment-intents")
      .set("Authorization", "Bearer token-com-assinatura-invalida")
      .send({ pedidoId: "p1", total: 10 });

    expect(res.status).toBe(401);
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
  });

  // Task 9.2.1
  it("RN16: token interno valido + Stripe mockado com sucesso -> 200 com paymentIntentId/clientSecret, contrato reduzido a {pedidoId, total}", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ aud: SELF_URL, email: CALLER_EMAIL }),
    });
    mockPaymentIntentsCreate.mockResolvedValue({
      id: "pi_int_1",
      client_secret: "pi_int_1_secret",
    });

    const res = await request(app)
      .post("/internal/payment-intents")
      .set("Authorization", "Bearer token-interno-valido-de-orders")
      .send({ pedidoId: "pedido-789", total: 25.5 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ paymentIntentId: "pi_int_1", clientSecret: "pi_int_1_secret" });
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2550, metadata: { pedidoId: "pedido-789" } }),
    );
  });

  // Task 9.2.1
  it("RN16: token interno valido + Stripe mockado falhando -> 502 (PaymentGatewayError local de Payments)", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ aud: SELF_URL, email: CALLER_EMAIL }),
    });
    mockPaymentIntentsCreate.mockRejectedValue(new Error("stripe indisponivel (simulado)"));

    const res = await request(app)
      .post("/internal/payment-intents")
      .set("Authorization", "Bearer token-interno-valido-de-orders")
      .send({ pedidoId: "pedido-000", total: 5 });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      error: { code: expect.any(String), message: expect.any(String) },
    });
  });

  it("regressao: GET /produtos nao existe em Payments (Task 8.3.3 - so /health e /webhooks/stripe alem das rotas internas)", async () => {
    const res = await request(app).get("/produtos");
    expect(res.status).toBe(404);
  });
});
