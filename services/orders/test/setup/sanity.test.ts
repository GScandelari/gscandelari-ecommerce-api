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
    const soma = (a: number, b: number): number => a + b;
    expect(soma(1, 1)).toBe(2);
  });

  it("Task 3.1.2 / 1.2.3: GET /health via Supertest retorna 200 e expõe APP_ENV", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("env");
  });

  it("Task 2.7.2: GET /docs serve a Swagger UI", async () => {
    const response = await request(app).get("/docs/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("swagger-ui");
  });
});
