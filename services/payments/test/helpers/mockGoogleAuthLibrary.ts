/**
 * Mocka o pacote real `google-auth-library` (duplicado de
 * services/orders/test/helpers/mockGoogleAuthLibrary.ts, conforme a Decisao
 * tecnica 4 do BACKLOG) para os dois lados da autenticacao servico-a-servico
 * em Payments (RN18):
 *
 * - Lado emissor (`mintInternalToken`, Task 9.1.1): usado ao chamar os
 *   endpoints internos de Orders (`orders.internalClient.ts`, Task 9.3.2).
 * - Lado receptor (`verifyInternalToken`, Task 9.1.2): usado por
 *   `POST /internal/payment-intents` (Task 9.2.1), chamado por Orders.
 */

export const mockFetchIdToken = jest.fn();
export const mockGetIdTokenClient = jest.fn(() => ({ fetchIdToken: mockFetchIdToken }));
export const mockVerifyIdToken = jest.fn();

jest.mock("google-auth-library", () => {
  return {
    GoogleAuth: jest.fn().mockImplementation(() => ({
      getIdTokenClient: mockGetIdTokenClient,
    })),
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    })),
  };
});

/**
 * Reseta os mocks entre casos de teste (chamar em `beforeEach`).
 */
export function resetGoogleAuthLibraryMocks(): void {
  mockFetchIdToken.mockReset();
  mockGetIdTokenClient.mockReset();
  mockGetIdTokenClient.mockImplementation(() => ({ fetchIdToken: mockFetchIdToken }));
  mockVerifyIdToken.mockReset();
}
