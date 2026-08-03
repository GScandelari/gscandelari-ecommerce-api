// Este import DEVE vir antes de `../../src/internalAuth` para que o mock de
// `google-auth-library` seja registrado antes de qualquer `require` real.
import {
  mockFetchIdToken,
  mockGetIdTokenClient,
  resetGoogleAuthLibraryMocks,
} from "../helpers/mockGoogleAuthLibrary";
// Task 9.1.1 (Modulo 9 - AINDA NAO IMPLEMENTADO): `mintInternalToken`.
// Import falhara ("Cannot find module") ate `src/internalAuth.ts` ser criado
// em services/orders - estado "vermelho" esperado em TDD, base de RN16/RN17.
import { mintInternalToken } from "../../src/internalAuth";

describe("mintInternalToken - base de RN16/RN17 (Task 9.1.1, duplicado em Orders e Payments)", () => {
  beforeEach(() => {
    resetGoogleAuthLibraryMocks();
  });

  it("emite o ID token do Google para o audience informado via GoogleAuth().getIdTokenClient(audience).fetchIdToken(audience)", async () => {
    mockFetchIdToken.mockResolvedValue("id-token-simulado-para-payments");

    const token = await mintInternalToken("https://payments-api-xyz.a.run.app");

    expect(token).toBe("id-token-simulado-para-payments");
    expect(mockGetIdTokenClient).toHaveBeenCalledWith("https://payments-api-xyz.a.run.app");
    expect(mockFetchIdToken).toHaveBeenCalledWith("https://payments-api-xyz.a.run.app");
  });

  it("propaga o erro se a emissao do token falhar (ex.: metadata server indisponivel/nao roda no emulator)", async () => {
    mockFetchIdToken.mockRejectedValue(new Error("metadata server indisponivel (simulado)"));

    await expect(mintInternalToken("https://payments-api-xyz.a.run.app")).rejects.toThrow(
      "metadata server indisponivel (simulado)",
    );
  });
});
