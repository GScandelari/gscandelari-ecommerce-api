import { Request, Response } from "express";
// Task 2.2.2 (Modulo 2 - AINDA NAO IMPLEMENTADO): middleware `requireAdmin`.
// Import falhara ("Cannot find module") ate src/middlewares/requireAdmin.ts
// ser criado - estado "vermelho" esperado em TDD para RN07/RN09.
import { requireAdmin } from "../../src/middlewares/requireAdmin";

function mockReqRes(user: { uid: string; claims: Record<string, unknown> }) {
  const req = { user } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn();
  return { req, res, next };
}

describe("Middleware requireAdmin - RN07, RN09 (Task 2.2.2 / 3.4.2)", () => {
  it("RN07, RN09: usuario sem custom claim admin -> 403", () => {
    const { req, res, next } = mockReqRes({ uid: "cliente-1", claims: {} });
    requireAdmin(req, res, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("RN07, RN09: usuario com claim admin:true -> segue adiante (next)", () => {
    const { req, res, next } = mockReqRes({ uid: "admin-1", claims: { admin: true } });
    requireAdmin(req, res, next as any);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});
