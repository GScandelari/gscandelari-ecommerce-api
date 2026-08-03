// Este import DEVE vir antes de `../../src/services/orders.internalClient`
// para que o mock de `google-auth-library` seja registrado antes de
// qualquer `require` real (mintInternalToken usa GoogleAuth por baixo).
import { mockFetchIdToken, resetGoogleAuthLibraryMocks } from "../helpers/mockGoogleAuthLibrary";
import {
  cancelarPedidoPorFalhaPagamento,
  confirmarPagamentoPedido,
} from "../../src/services/orders.internalClient";

/**
 * Testes unitarios do cliente HTTP interno para Orders - RN17. Diferente
 * dos testes de integracao (webhookInternalCall.test.ts), que mockam este
 * modulo inteiro na fronteira, aqui e o proprio modulo que esta sob teste -
 * `fetch` e mockado diretamente (sem chamada de rede real), garantindo
 * cobertura da logica de montagem da requisicao/tratamento de erro que,
 * de outra forma, nunca seria exercitada (sempre mockada nos demais testes).
 */
describe("orders.internalClient - RN17 (Modulo 9 - Epico 9.3 - Task 9.3.2)", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.ORDERS_BASE_URL;

  beforeEach(() => {
    resetGoogleAuthLibraryMocks();
    mockFetchIdToken.mockResolvedValue("token-interno-simulado");
    process.env.ORDERS_BASE_URL = "https://orders-api-xyz.a.run.app";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ORDERS_BASE_URL = originalEnv;
  });

  it("confirmarPagamentoPedido chama a rota interna correta com token e corpo esperados", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

    await confirmarPagamentoPedido("pedido-123");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://orders-api-xyz.a.run.app/internal/pedidos/pedido-123/confirmar-pagamento",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-interno-simulado",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("cancelarPedidoPorFalhaPagamento chama a rota interna correta", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

    await cancelarPedidoPorFalhaPagamento("pedido-456");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://orders-api-xyz.a.run.app/internal/pedidos/pedido-456/cancelar-por-falha-pagamento",
      expect.anything(),
    );
  });

  it("propaga erro quando a resposta HTTP nao e 'ok' (ex.: 401/5xx de Orders)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve("Orders indisponivel"),
    });

    await expect(confirmarPagamentoPedido("pedido-789")).rejects.toThrow(/HTTP 503/);
  });

  it("propaga erro se ORDERS_BASE_URL nao estiver configurada", async () => {
    delete process.env.ORDERS_BASE_URL;

    await expect(confirmarPagamentoPedido("pedido-000")).rejects.toThrow("ORDERS_BASE_URL nao configurada.");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
