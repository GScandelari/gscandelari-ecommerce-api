import request from "supertest";
import app from "../../src/app";

/**
 * Testes de sanidade da infraestrutura de teste (Modulo 3 - Epico 3.1).
 * Nao rastreiam nenhuma RNxx: validam apenas que Jest + ts-jest + Supertest
 * estao configurados corretamente. Devem passar mesmo sem o Modulo 2
 * (Core Business) implementado.
 */
describe("Infra de testes", () => {
  it("Task 3.1.1: Jest + ts-jest executam um teste trivial de sanidade", () => {
    expect(1 + 1).toBe(2);
  });

  it("Task 3.1.2: GET /health via Supertest contra o app importado retorna 200", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
