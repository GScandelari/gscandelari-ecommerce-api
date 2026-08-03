/**
 * Mocka o pacote real `google-auth-library` (instalado como dependencia de
 * producao, nao um modulo virtual) para os dois lados da autenticacao
 * servico-a-servico (RN18):
 *
 * - Lado emissor (`mintInternalToken`, Task 9.1.1): `GoogleAuth().getIdTokenClient(audience).fetchIdToken(audience)`.
 * - Lado receptor (`verifyInternalToken`, Task 9.1.2): `new OAuth2Client().verifyIdToken({ idToken, audience })`.
 *
 * Sem este mock, os testes dependeriam do metadata server do GCP (que nao
 * existe no Emulator Suite nem neste ambiente de teste local) para emitir/
 * validar tokens reais - por isso RN18 e testada inteiramente com o SDK
 * mockado, nunca contra credenciais/rede reais (mesmo espirito do mock do
 * Stripe na Fase 2).
 */

export const mockFetchIdToken = jest.fn();
// Forma real do IdTokenClient do google-auth-library: fetchIdToken vive em
// `client.idTokenProvider.fetchIdToken(audience)`, nao diretamente no
// client (IdTokenClient nao expoe fetchIdToken publico - ver
// node_modules/google-auth-library/build/src/auth/idtokenclient.d.ts).
export const mockGetIdTokenClient = jest.fn(() => ({
  idTokenProvider: { fetchIdToken: mockFetchIdToken },
}));
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
  mockGetIdTokenClient.mockImplementation(() => ({
    idTokenProvider: { fetchIdToken: mockFetchIdToken },
  }));
  mockVerifyIdToken.mockReset();
}
