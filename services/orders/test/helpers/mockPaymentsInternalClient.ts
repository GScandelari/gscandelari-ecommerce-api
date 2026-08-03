/**
 * Mocka o cliente HTTP interno de Orders para Payments
 * (`src/services/payments.internalClient.ts`, Task 9.2.2, AINDA NAO
 * IMPLEMENTADO), para que a suite de Orders nunca faca uma chamada HTTP real
 * ao servico Payments - RN16, RN18.
 *
 * Segue exatamente o mesmo padrao ja usado em `mockStripe.ts` (Fase 2):
 * mocka o MODULO DE FRONTEIRA (o cliente interno), nao o transporte HTTP
 * (fetch/axios) por baixo dele - assim o teste permanece estavel
 * independente da biblioteca HTTP escolhida na implementacao.
 *
 * Contrato mockado (Decisao tecnica 3 do BACKLOG - Fase 3): o cliente expoe
 * `criarPaymentIntent(pedidoId: string, total: number)` -> `{ paymentIntentId, clientSecret }`,
 * deliberadamente reduzido (sem receber o objeto `Pedido` inteiro).
 */

export const mockCriarPaymentIntent = jest.fn();

jest.mock(
  "@/services/payments.internalClient",
  () => ({
    criarPaymentIntent: mockCriarPaymentIntent,
  }),
  { virtual: true },
);

/**
 * Reseta o mock entre casos de teste (chamar em `beforeEach`).
 */
export function resetPaymentsInternalClientMocks(): void {
  mockCriarPaymentIntent.mockReset();
}
