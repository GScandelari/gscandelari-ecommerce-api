// Este import DEVE vir antes de `../../src/internalAuth` para que o mock de
// `google-auth-library` seja registrado antes de qualquer `require` real.
import { mockFetchIdToken, mockGetIdTokenClient, resetGoogleAuthLibraryMocks } from "../helpers/mockGoogleAuthLibrary";
// Task 9.1.1 (Modulo 9 - AINDA NAO IMPLEMENTADO): `mintInternalToken`,
// duplicado em Payments (Decisao tecnica 4). Import falhara ate
// `src/internalAuth.ts` ser criado em services/payments - RN17.
import { mintInternalToken } from "../../src/internalAuth";

describe("mintInternalToken (em Payments, usado para chamar Orders) - base de RN17 (Task 9.1.1)", () => {
  beforeEach(() => {
    resetGoogleAuthLibraryMocks();
  });

  it("emite o ID token do Google para o audience (URL de Orders) via GoogleAuth().getIdTokenClient(audience).fetchIdToken(audience)", async () => {
    mockFetchIdToken.mockResolvedValue("id-token-simulado-para-orders");

    const token = await mintInternalToken("https://orders-api-xyz.a.run.app");

    expect(token).toBe("id-token-simulado-para-orders");
    expect(mockGetIdTokenClient).toHaveBeenCalledWith("https://orders-api-xyz.a.run.app");
    expect(mockFetchIdToken).toHaveBeenCalledWith("https://orders-api-xyz.a.run.app");
  });

  it("propaga o erro se a emissao do token falhar", async () => {
    mockFetchIdToken.mockRejectedValue(new Error("metadata server indisponivel (simulado)"));

    await expect(mintInternalToken("https://orders-api-xyz.a.run.app")).rejects.toThrow(
      "metadata server indisponivel (simulado)",
    );
  });
});
