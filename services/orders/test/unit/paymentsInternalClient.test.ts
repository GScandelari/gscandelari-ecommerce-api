// Este import DEVE vir antes de `../../src/services/payments.internalClient`
// para que o mock de `google-auth-library` seja registrado antes de
// qualquer `require` real (mintInternalToken usa GoogleAuth por baixo).
import { mockFetchIdToken, resetGoogleAuthLibraryMocks } from "../helpers/mockGoogleAuthLibrary";
import {
  criarPaymentIntent,
  reembolsarPagamento,
} from "../../src/services/payments.internalClient";

/**
 * Testes unitarios do cliente HTTP interno para Payments - RN16. Diferente
 * dos testes de integracao (pedidosPagamentoInterno.test.ts), que mockam
 * este modulo inteiro na fronteira, aqui e o proprio modulo que esta sob
 * teste - `fetch` e mockado diretamente (sem chamada de rede real),
 * garantindo cobertura da logica de montagem da requisicao/tratamento de
 * erro que, de outra forma, nunca seria exercitada (sempre mockada nos
 * demais testes). Espelha payments/test/unit/ordersInternalClient.test.ts.
 */
describe("payments.internalClient - RN16 (Modulo 9 - Epico 9.2 - Task 9.2.2)", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.PAYMENTS_BASE_URL;

  beforeEach(() => {
    resetGoogleAuthLibraryMocks();
    mockFetchIdToken.mockResolvedValue("token-interno-simulado");
    process.env.PAYMENTS_BASE_URL = "https://payments-api-xyz.a.run.app";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.PAYMENTS_BASE_URL = originalEnv;
  });

  it("chama POST /internal/payment-intents com token e corpo esperados, retorna o resultado parseado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ paymentIntentId: "pi_1", clientSecret: "secret_1" }),
    });

    const resultado = await criarPaymentIntent("pedido-123", 60);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://payments-api-xyz.a.run.app/internal/payment-intents",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-interno-simulado",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ pedidoId: "pedido-123", total: 60 }),
      }),
    );
    expect(resultado).toEqual({ paymentIntentId: "pi_1", clientSecret: "secret_1" });
  });

  it("propaga erro quando a resposta HTTP nao e 'ok' (ex.: 401/5xx de Payments)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve("Payments indisponivel"),
    });

    await expect(criarPaymentIntent("pedido-789", 10)).rejects.toThrow(/HTTP 502/);
  });

  it("propaga erro se PAYMENTS_BASE_URL nao estiver configurada", async () => {
    delete process.env.PAYMENTS_BASE_URL;

    await expect(criarPaymentIntent("pedido-000", 5)).rejects.toThrow(
      "PAYMENTS_BASE_URL nao configurada.",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Fase 5 (Modulo 22.7 - RN32), mesmo padrao de teste de criarPaymentIntent.
  describe("reembolsarPagamento(paymentIntentId, amount) - RN32", () => {
    it("chama POST /internal/refunds com token e corpo esperados", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      await reembolsarPagamento("pi_123", 6000);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://payments-api-xyz.a.run.app/internal/refunds",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token-interno-simulado",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ paymentIntentId: "pi_123", amount: 6000 }),
        }),
      );
    });

    it("propaga erro quando a resposta HTTP nao e 'ok' (ex.: 502 de Payments)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve("Payments indisponivel"),
      });

      await expect(reembolsarPagamento("pi_456", 1000)).rejects.toThrow(/HTTP 502/);
    });

    it("propaga erro se PAYMENTS_BASE_URL nao estiver configurada", async () => {
      delete process.env.PAYMENTS_BASE_URL;

      await expect(reembolsarPagamento("pi_789", 500)).rejects.toThrow(
        "PAYMENTS_BASE_URL nao configurada.",
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
