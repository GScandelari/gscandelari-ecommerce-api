/**
 * Mocka o SDK do Resend via `jest.mock` sobre
 * `services/notifications/src/resendClient.ts` (Task 10.1.1, AINDA NAO
 * IMPLEMENTADO), para que a suite de Notifications nunca faca uma chamada de
 * rede real ao Resend - RN19. Mesmo padrao ja usado para o Stripe na Fase 2
 * (`jest.mock` com `virtual: true` sobre o modulo de fronteira que ainda nao
 * existe no filesystem).
 */

export const mockEmailsSend = jest.fn();

jest.mock(
  "@/resendClient",
  () => ({
    getResendClient: () => ({
      emails: { send: mockEmailsSend },
    }),
  }),
  { virtual: true },
);

/**
 * Reseta o mock entre casos de teste (chamar em `beforeEach`).
 */
export function resetResendMocks(): void {
  mockEmailsSend.mockReset();
}
