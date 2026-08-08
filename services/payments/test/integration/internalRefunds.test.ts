// Estes imports DEVEM vir antes de `../../src/app` para que os mocks
// virtuais/reais sejam registrados antes de qualquer `require` real do
// cliente Stripe ou da `google-auth-library`.
import { mockRefundsCreate, resetStripeMocks } from "../helpers/mockStripe";
import { mockVerifyIdToken, resetGoogleAuthLibraryMocks } from "../helpers/mockGoogleAuthLibrary";
import request from "supertest";
import app from "../../src/app";

/**
 * Testes de integracao de `POST /internal/refunds` (Payments) - RN32, RN18
 * (Fase 5, Modulo 22.7 - Decisao tecnica 6 do BACKLOG). Mesmo padrao de
 * `internalPaymentIntents.test.ts` (Fase 3).
 *
 * Contrato: recebe `{ paymentIntentId: string, amount: number }` (Orders
 * calcula o valor em centavos a partir de `pedido.total`, mesmo padrao de
 * `/internal/payment-intents`), retorna `{ received: true }`.
 */

const SELF_URL = "https://payments-api-xyz.a.run.app";
const CALLER_EMAIL = "orders-runtime@demo-gscandelari-ecommerce-api.iam.gserviceaccount.com";

describe("POST /internal/refunds (Payments) - RN32, RN18 (Fase 5, Modulo 22.7)", () => {
  beforeEach(() => {
    resetStripeMocks();
    resetGoogleAuthLibraryMocks();
    process.env.SELF_BASE_URL = SELF_URL;
    process.env.ALLOWED_CALLER_SERVICE_ACCOUNT_EMAIL = CALLER_EMAIL;
  });

  it("RN18: sem header Authorization -> 401, Stripe nunca chamado", async () => {
    const res = await request(app)
      .post("/internal/refunds")
      .send({ paymentIntentId: "pi_1", amount: 1000 });

    expect(res.status).toBe(401);
    expect(mockRefundsCreate).not.toHaveBeenCalled();
  });

  it("RN18: token interno com assinatura invalida -> 401, Stripe nunca chamado", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("assinatura invalida (simulado)"));

    const res = await request(app)
      .post("/internal/refunds")
      .set("Authorization", "Bearer token-com-assinatura-invalida")
      .send({ paymentIntentId: "pi_1", amount: 1000 });

    expect(res.status).toBe(401);
    expect(mockRefundsCreate).not.toHaveBeenCalled();
  });

  it("RN32: token interno valido + Stripe mockado com sucesso -> 200 { received: true }", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ aud: SELF_URL, email: CALLER_EMAIL }),
    });
    mockRefundsCreate.mockResolvedValue({ id: "re_int_1", status: "succeeded" });

    const res = await request(app)
      .post("/internal/refunds")
      .set("Authorization", "Bearer token-interno-valido-de-orders")
      .send({ paymentIntentId: "pi_int_777", amount: 5000 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockRefundsCreate).toHaveBeenCalledWith({
      payment_intent: "pi_int_777",
      amount: 5000,
    });
  });

  it("RN32: token interno valido + Stripe mockado falhando -> 502 (PaymentGatewayError local de Payments)", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ aud: SELF_URL, email: CALLER_EMAIL }),
    });
    mockRefundsCreate.mockRejectedValue(new Error("stripe indisponivel (simulado)"));

    const res = await request(app)
      .post("/internal/refunds")
      .set("Authorization", "Bearer token-interno-valido-de-orders")
      .send({ paymentIntentId: "pi_int_000", amount: 500 });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      error: { code: expect.any(String), message: expect.any(String) },
    });
  });

  it("payload invalido (sem paymentIntentId/amount) -> 400, Stripe nunca chamado", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ aud: SELF_URL, email: CALLER_EMAIL }),
    });

    const res = await request(app)
      .post("/internal/refunds")
      .set("Authorization", "Bearer token-interno-valido-de-orders")
      .send({});

    expect(res.status).toBe(400);
    expect(mockRefundsCreate).not.toHaveBeenCalled();
  });
});
