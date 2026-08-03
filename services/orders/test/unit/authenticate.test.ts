import { Request, Response } from "express";
// Task 2.2.1 (Modulo 2 - AINDA NAO IMPLEMENTADO): middleware `authenticate`.
// Import falhara ("Cannot find module") ate src/middlewares/authenticate.ts
// ser criado - estado "vermelho" esperado em TDD para RN09.
import { authenticate } from "../../src/middlewares/authenticate";
import { createTestUser } from "../helpers/testAuth";

function mockReqRes() {
  const req = { headers: {} as Record<string, string> } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn();
  return { req, res, next };
}

describe("Middleware authenticate - RN09 (Task 2.2.1 / 3.4.1)", () => {
  it("RN09: sem header Authorization -> 401", async () => {
    const { req, res, next } = mockReqRes();
    await authenticate(req, res, next as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("RN09: token invalido/expirado -> 401", async () => {
    const { req, res, next } = mockReqRes();
    (req.headers as Record<string, string>).authorization = "Bearer token-invalido-ou-expirado";
    await authenticate(req, res, next as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("RN09: token valido popula req.user (uid/claims) e chama next()", async () => {
    const user = await createTestUser({ admin: false });
    const { req, res, next } = mockReqRes();
    (req.headers as Record<string, string>).authorization = `Bearer ${user.idToken}`;

    await authenticate(req, res, next as any);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(401);
    expect((req as any).user?.uid).toBe(user.uid);
  });
});
