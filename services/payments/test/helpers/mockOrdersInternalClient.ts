/**
 * Mocka o cliente HTTP interno de Payments para Orders
 * (`src/services/orders.internalClient.ts`, Task 9.3.2, AINDA NAO
 * IMPLEMENTADO), para que a suite de Payments nunca faca uma chamada HTTP
 * real ao servico Orders - RN17, RN18.
 *
 * Mesmo padrao de `mockPaymentsInternalClient.ts` (Orders) e `mockStripe.ts`:
 * mocka o modulo de fronteira, nao o transporte HTTP por baixo dele.
 *
 * Contrato mockado (Task 9.3.1): `confirmarPagamentoPedido(pedidoId)` e
 * `cancelarPedidoPorFalhaPagamento(pedidoId)`, ambas `Promise<void>`,
 * espelhando as funcoes internas equivalentes que hoje (Fase 2) o handler
 * do webhook chamava por import direto.
 */

export const mockConfirmarPagamentoPedido = jest.fn();
export const mockCancelarPedidoPorFalhaPagamento = jest.fn();

jest.mock(
  "@/services/orders.internalClient",
  () => ({
    confirmarPagamentoPedido: mockConfirmarPagamentoPedido,
    cancelarPedidoPorFalhaPagamento: mockCancelarPedidoPorFalhaPagamento,
  }),
  { virtual: true },
);

/**
 * Reseta os mocks entre casos de teste (chamar em `beforeEach`).
 */
export function resetOrdersInternalClientMocks(): void {
  mockConfirmarPagamentoPedido.mockReset();
  mockCancelarPedidoPorFalhaPagamento.mockReset();
}
