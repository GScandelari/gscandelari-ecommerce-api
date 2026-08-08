/**
 * Helper de teste reutilizavel (Modulo 7 - Epico 7.1 - Task 7.1.1): mocka o
 * SDK do Stripe via `jest.mock` sobre `functions/src/stripeClient.ts`
 * (Modulo 5 - Epico 5.1, AINDA NAO IMPLEMENTADO), para que a suite de testes
 * nunca faca uma chamada de rede real ao Stripe e nunca dependa de internet
 * no CI.
 *
 * Usa a opcao `virtual: true` do `jest.mock`, feita exatamente para mockar
 * modulos que ainda nao existem no filesystem: o helper em si funciona
 * (fica "verde") independente do estado do Modulo 5, permitindo configurar
 * `paymentIntents.create` e `webhooks.constructEvent` por teste (sucesso ou
 * erro). O "vermelho" esperado nesta fase vem de qualquer teste que importe
 * `src/services/stripeService.ts`, `src/routes/webhooks.routes.ts`, etc.
 * (Modulos 5/6, ainda nao implementados) - nao deste helper.
 *
 * Fase 5 (Modulo 22 - Epico 22.1 - Task 22.1.1): estendido para simular
 * tambem `stripe.refunds.create` (RN32, `reembolsarPedido` - Modulo 20,
 * AINDA NAO IMPLEMENTADO), com sucesso/erro configuraveis por teste, no
 * mesmo padrao ja usado para `paymentIntents.create`.
 *
 * Uso: importar este modulo ANTES de importar `src/app` (ou qualquer modulo
 * que transitivamente importe `@/stripeClient`), para garantir que o mock
 * seja registrado antes do primeiro `require` real do cliente Stripe.
 */

export const mockPaymentIntentsCreate = jest.fn();
export const mockWebhooksConstructEvent = jest.fn();
export const mockRefundsCreate = jest.fn();

jest.mock(
  "@/stripeClient",
  () => ({
    getStripeClient: () => ({
      paymentIntents: {
        create: mockPaymentIntentsCreate,
      },
      webhooks: {
        constructEvent: mockWebhooksConstructEvent,
      },
      refunds: {
        create: mockRefundsCreate,
      },
    }),
  }),
  { virtual: true },
);

/**
 * Reseta os mocks entre casos de teste (chamar em `beforeEach`), evitando
 * que configuracao de um teste (ex.: `mockRejectedValue`) vaze para o
 * proximo.
 */
export function resetStripeMocks(): void {
  mockPaymentIntentsCreate.mockReset();
  mockWebhooksConstructEvent.mockReset();
  mockRefundsCreate.mockReset();
}
