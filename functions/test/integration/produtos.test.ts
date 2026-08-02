import request from "supertest";
import app from "../../src/app";
import { createTestUser, TestUser } from "../helpers/testAuth";
import { clearFirestoreEmulator } from "../helpers/firestoreTestUtils";

/**
 * Testes de integracao de Produtos - RN01, RN07, RN09 (Modulo 3 - Epico 3.2).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): o app (src/app.ts) so implementa
 * `/health` neste estagio de bootstrap. As rotas /produtos pertencem ao
 * Modulo 2 (Epico 2.5) e AINDA NAO EXISTEM, entao toda requisicao abaixo
 * recebe 404 do Express (rota nao registrada) em vez do status esperado
 * pela regra de negocio - falhas de asserção esperadas, não erros de setup.
 *
 * Requer Auth + Firestore Emulator rodando (`npm run test:emulator`).
 */
describe("Produtos - RN01, RN07, RN09 (Modulo 3 - Epico 3.2)", () => {
  let adminUser: TestUser;
  let cliente: TestUser;

  beforeAll(async () => {
    await clearFirestoreEmulator();
    adminUser = await createTestUser({ admin: true });
    cliente = await createTestUser({ admin: false });
  });

  afterEach(async () => {
    await clearFirestoreEmulator();
  });

  describe("POST /produtos (Task 2.5.1 / 3.2.1)", () => {
    it("RN01, RN07: admin com payload valido -> 201 com produto criado", async () => {
      const res = await request(app)
        .post("/produtos")
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ nome: "Camiseta", preco: 49.9, estoque: 10 });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ nome: "Camiseta", preco: 49.9, estoque: 10 });
      expect(res.body.id).toBeDefined();
    });

    it("RN01: payload invalido (preco negativo) -> 400", async () => {
      const res = await request(app)
        .post("/produtos")
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ nome: "Produto invalido", preco: -1, estoque: 10 });

      expect(res.status).toBe(400);
    });

    it("RN01: payload invalido (estoque nao inteiro) -> 400", async () => {
      const res = await request(app)
        .post("/produtos")
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ nome: "Produto invalido", preco: 10, estoque: 1.5 });

      expect(res.status).toBe(400);
    });

    it("RN07, RN09: usuario nao-admin -> 403", async () => {
      const res = await request(app)
        .post("/produtos")
        .set("Authorization", `Bearer ${cliente.idToken}`)
        .send({ nome: "Camiseta", preco: 49.9, estoque: 10 });

      expect(res.status).toBe(403);
    });

    it("RN09: sem token -> 401", async () => {
      const res = await request(app).post("/produtos").send({ nome: "Camiseta", preco: 49.9, estoque: 10 });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /produtos, GET /produtos/:id, PUT /produtos/:id, DELETE /produtos/:id (Task 3.2.2)", () => {
    async function criarProdutoDeTeste(): Promise<string> {
      const res = await request(app)
        .post("/produtos")
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ nome: "Produto Base", preco: 20, estoque: 5 });
      return res.body?.id as string;
    }

    it("RN09: GET /produtos autenticado -> 200 com lista", async () => {
      const res = await request(app).get("/produtos").set("Authorization", `Bearer ${cliente.idToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("RN09: GET /produtos sem token -> 401", async () => {
      const res = await request(app).get("/produtos");
      expect(res.status).toBe(401);
    });

    it("GET /produtos/:id existente -> 200", async () => {
      const id = await criarProdutoDeTeste();
      const res = await request(app).get(`/produtos/${id}`).set("Authorization", `Bearer ${cliente.idToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    });

    it("GET /produtos/:id inexistente -> 404", async () => {
      const res = await request(app)
        .get("/produtos/id-que-nao-existe")
        .set("Authorization", `Bearer ${cliente.idToken}`);
      expect(res.status).toBe(404);
    });

    it("RN01, RN07: PUT /produtos/:id admin com dados validos -> 200", async () => {
      const id = await criarProdutoDeTeste();
      const res = await request(app)
        .put(`/produtos/${id}`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ nome: "Produto Atualizado", preco: 30, estoque: 8 });
      expect(res.status).toBe(200);
      expect(res.body.nome).toBe("Produto Atualizado");
    });

    it("RN07: PUT /produtos/:id nao-admin -> 403", async () => {
      const id = await criarProdutoDeTeste();
      const res = await request(app)
        .put(`/produtos/${id}`)
        .set("Authorization", `Bearer ${cliente.idToken}`)
        .send({ nome: "Tentativa", preco: 30, estoque: 8 });
      expect(res.status).toBe(403);
    });

    it("RN01: PUT /produtos/:id com estoque negativo -> 400", async () => {
      const id = await criarProdutoDeTeste();
      const res = await request(app)
        .put(`/produtos/${id}`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ nome: "Produto", preco: 30, estoque: -1 });
      expect(res.status).toBe(400);
    });

    it("RN07: DELETE /produtos/:id admin remove produto existente -> 204", async () => {
      const id = await criarProdutoDeTeste();
      const res = await request(app).delete(`/produtos/${id}`).set("Authorization", `Bearer ${adminUser.idToken}`);
      expect(res.status).toBe(204);
    });

    it("RN07: DELETE /produtos/:id nao-admin -> 403", async () => {
      const id = await criarProdutoDeTeste();
      const res = await request(app).delete(`/produtos/${id}`).set("Authorization", `Bearer ${cliente.idToken}`);
      expect(res.status).toBe(403);
    });

    it("DELETE /produtos/:id inexistente -> 404", async () => {
      const res = await request(app)
        .delete("/produtos/id-que-nao-existe")
        .set("Authorization", `Bearer ${adminUser.idToken}`);
      expect(res.status).toBe(404);
    });
  });
});
