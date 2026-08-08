/**
 * Helper de teste reutilizavel (mesmo padrao da Task 7.1.1 / Fase 2): mocka o
 * SDK do Stripe via `jest.mock` sobre `services/payments/src/stripeClient.ts`
 * (Modulo 8 - Epico 8.3, AINDA NAO IMPLEMENTADO), para que a suite de testes
 * de Payments nunca faca uma chamada de rede real ao Stripe.
 *
 * Usa `virtual: true` porque o modulo ainda nao existe no filesystem deste
 * codebase - o helper em si funciona independente do estado do Modulo 8/9.
 */

export const mockPaymentIntentsCreate = jest.fn();
export const mockWebhooksConstructEvent = jest.fn();
/** Fase 5 (Modulo 22.7 - RN32): `stripe.refunds.create`. */
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
 * Reseta os mocks entre casos de teste (chamar em `beforeEach`).
 */
export function resetStripeMocks(): void {
  mockPaymentIntentsCreate.mockReset();
  mockWebhooksConstructEvent.mockReset();
  mockRefundsCreate.mockReset();
}
