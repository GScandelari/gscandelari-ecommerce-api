// Este import DEVE vir antes de `../../src/middlewares/verifyInternalToken`
// para que o mock de `google-auth-library` seja registrado antes de
// qualquer `require` real.
import { mockVerifyIdToken, resetGoogleAuthLibraryMocks } from "../helpers/mockGoogleAuthLibrary";
import { Request, Response } from "express";
// Task 9.1.2 (Modulo 9 - AINDA NAO IMPLEMENTADO): middleware
// `verifyInternalToken`. Import falhara ate `src/middlewares/verifyInternalToken.ts`
// ser criado em services/orders - estado "vermelho" esperado em TDD - RN18.
import { verifyInternalToken } from "../../src/middlewares/verifyInternalToken";

const SELF_URL = "https://orders-api-xyz.a.run.app";
const CALLER_EMAIL = "payments-runtime@demo-gscandelari-ecommerce-api.iam.gserviceaccount.com";

function mockReqRes(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn();
  return { req, res, next };
}

describe("Middleware verifyInternalToken (em Orders, recebe chamadas de Payments) - RN18 (Task 9.1.2 / 12.2.3)", () => {
  beforeEach(() => {
    resetGoogleAuthLibraryMocks();
    process.env.SELF_BASE_URL = SELF_URL;
    process.env.ALLOWED_CALLER_SERVICE_ACCOUNT_EMAIL = CALLER_EMAIL;
  });

  afterEach(() => {
    delete process.env.SKIP_INTERNAL_AUTH;
    delete process.env.FUNCTIONS_EMULATOR;
  });

  // Task 9.1.5
  it("Task 9.1.5: SKIP_INTERNAL_AUTH=true + FUNCTIONS_EMULATOR=true -> segue adiante mesmo sem token", async () => {
    process.env.SKIP_INTERNAL_AUTH = "true";
    process.env.FUNCTIONS_EMULATOR = "true";
    const { req, res, next } = mockReqRes();

    await verifyInternalToken(req, res, next as any);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  // Task 9.1.5 - dupla trava: SKIP_INTERNAL_AUTH sozinho (sem FUNCTIONS_EMULATOR) nunca faz bypass.
  it("Task 9.1.5: SKIP_INTERNAL_AUTH=true SEM FUNCTIONS_EMULATOR=true -> nao faz bypass, 401 sem token", async () => {
    process.env.SKIP_INTERNAL_AUTH = "true";
    const { req, res, next } = mockReqRes();

    await verifyInternalToken(req, res, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("RN18: sem header Authorization -> 401, verifyIdToken nunca chamado", async () => {
    const { req, res, next } = mockReqRes();
    await verifyInternalToken(req, res, next as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it("RN18: assinatura invalida (verifyIdToken lanca excecao) -> 401", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("assinatura invalida (simulado)"));
    const { req, res, next } = mockReqRes({
      authorization: "Bearer token-com-assinatura-invalida",
    });

    await verifyInternalToken(req, res, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("RN18: aud (audience) do token nao bate com a URL do proprio servico -> 401", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        aud: "https://outro-servico-nao-e-este.a.run.app",
        email: CALLER_EMAIL,
      }),
    });
    const { req, res, next } = mockReqRes({ authorization: "Bearer token-aud-errado" });

    await verifyInternalToken(req, res, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("RN18: email do chamador fora da allow-list (ALLOWED_CALLER_SERVICE_ACCOUNT_EMAIL) -> 401", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ aud: SELF_URL, email: "atacante@evil.example.com" }),
    });
    const { req, res, next } = mockReqRes({ authorization: "Bearer token-email-nao-permitido" });

    await verifyInternalToken(req, res, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("RN18: token valido, aud correto e email na allow-list -> segue adiante (next), sem 401", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ aud: SELF_URL, email: CALLER_EMAIL }),
    });
    const { req, res, next } = mockReqRes({ authorization: "Bearer token-valido-de-payments" });

    await verifyInternalToken(req, res, next as any);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(401);
  });
});
