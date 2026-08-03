// Import DEVE vir antes de "../../src/app": a partir da Fase 2, POST
// /pedidos chama o pagamento (RN10) - na Fase 3, via chamada HTTP interna
// ao servico Payments (@/services/payments.internalClient), nao mais
// @/stripeClient diretamente. Sem este mock, os testes desta suite (que
// nao configuram um valor especifico de PaymentIntent) tentariam chamar
// Payments de verdade e falhariam por falta de PAYMENTS_BASE_URL/rede.
import { mockCriarPaymentIntent, resetPaymentsInternalClientMocks } from "../helpers/mockPaymentsInternalClient";
import request from "supertest";
import app from "../../src/app";
import { createTestUser, TestUser } from "../helpers/testAuth";
import { clearFirestoreEmulator } from "../helpers/firestoreTestUtils";
import { getAdminApp } from "../helpers/adminApp";

/**
 * Testes de integracao de Pedidos - RN02 a RN09, RN07a (migrados da Fase 1/
 * Modulo 3 para o servico Orders na Fase 3, Modulo 8). O pagamento (RN10)
 * e mockado na fronteira do cliente HTTP interno para Payments - o
 * conteudo do pagamento em si e testado em pedidosPagamentoInterno.test.ts.
 *
 * Requer Auth + Firestore Emulator rodando (`npm run test:emulator`).
 */

async function criarProduto(
  adminUser: TestUser,
  overrides: Partial<{ nome: string; preco: number; estoque: number }> = {},
): Promise<string> {
  const res = await request(app)
    .post("/produtos")
    .set("Authorization", `Bearer ${adminUser.idToken}`)
    .send({
      nome: overrides.nome ?? "Produto Teste",
      preco: overrides.preco ?? 10,
      estoque: overrides.estoque ?? 5,
    });
  return res.body?.id as string;
}

async function lerEstoqueDireto(produtoId: string): Promise<number | undefined> {
  const snap = await getAdminApp().firestore().collection("produtos").doc(produtoId).get();
  return snap.exists ? (snap.data()?.estoque as number) : undefined;
}

describe("Pedidos - RN02 a RN09, RN07a (Modulo 3 - Epico 3.3)", () => {
  let adminUser: TestUser;
  let clienteA: TestUser;
  let clienteB: TestUser;

  beforeAll(async () => {
    await clearFirestoreEmulator();
    adminUser = await createTestUser({ admin: true });
    clienteA = await createTestUser({ admin: false });
    clienteB = await createTestUser({ admin: false });
  });

  beforeEach(() => {
    resetPaymentsInternalClientMocks();
    // Valor padrao generico: esta suite testa as regras de Pedido da Fase
    // 1 (RN02-RN09/RN07a), nao o conteudo do pagamento em si (isso e
    // testado em pedidosPagamentoInterno.test.ts) - qualquer PaymentIntent
    // valida basta para o fluxo de criacao nao falhar.
    mockCriarPaymentIntent.mockResolvedValue({
      paymentIntentId: "pi_fase1_default",
      clientSecret: "secret_fase1_default",
    });
  });

  afterEach(async () => {
    await clearFirestoreEmulator();
  });

  // Task 3.3.1
  it("RN02, RN04: cliente cria pedido com estoque suficiente -> 201, total calculado, estoque decrementado", async () => {
    const produtoId = await criarProduto(adminUser, { preco: 15, estoque: 10 });

    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${clienteA.idToken}`)
      .send({ itens: [{ produtoId, quantidade: 3 }] });

    expect(res.status).toBe(201);
    expect(res.body.total).toBeCloseTo(45);
    expect(res.body.status).toBe("pendente");
    expect(await lerEstoqueDireto(produtoId)).toBe(7);
  });

  it("RN09: criar pedido sem token -> 401", async () => {
    const produtoId = await criarProduto(adminUser);
    const res = await request(app)
      .post("/pedidos")
      .send({ itens: [{ produtoId, quantidade: 1 }] });
    expect(res.status).toBe(401);
  });

  // Task 3.3.2
  it("RN03: criar pedido com estoque insuficiente -> 400, sem alteracao de estoque, sem pedido persistido", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 2 });

    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${clienteA.idToken}`)
      .send({ itens: [{ produtoId, quantidade: 5 }] });

    expect(res.status).toBe(400);
    expect(await lerEstoqueDireto(produtoId)).toBe(2);

    const pedidosSnap = await getAdminApp().firestore().collection("pedidos").get();
    expect(pedidosSnap.size).toBe(0);
  });

  // Task 3.3.3
  describe("Listagem/detalhe por cliente vs admin - RN08", () => {
    it("cliente A nao enxerga pedidos do cliente B; admin enxerga todos", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });

      const pedidoA = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });

      const pedidoB = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteB.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });

      const listaA = await request(app)
        .get("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`);
      expect(listaA.status).toBe(200);
      expect(listaA.body.every((p: any) => p.clienteId === clienteA.uid)).toBe(true);
      expect(listaA.body.some((p: any) => p.id === pedidoB.body.id)).toBe(false);

      const listaAdmin = await request(app)
        .get("/pedidos")
        .set("Authorization", `Bearer ${adminUser.idToken}`);
      expect(listaAdmin.status).toBe(200);
      const ids = listaAdmin.body.map((p: any) => p.id);
      expect(ids).toEqual(expect.arrayContaining([pedidoA.body.id, pedidoB.body.id]));
    });

    it("GET direto no pedido de outro cliente -> 403; admin acessa qualquer pedido -> 200", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedidoA = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });

      const acessoIndevido = await request(app)
        .get(`/pedidos/${pedidoA.body.id}`)
        .set("Authorization", `Bearer ${clienteB.idToken}`);
      expect(acessoIndevido.status).toBe(403);

      const acessoDono = await request(app)
        .get(`/pedidos/${pedidoA.body.id}`)
        .set("Authorization", `Bearer ${clienteA.idToken}`);
      expect(acessoDono.status).toBe(200);

      const acessoAdmin = await request(app)
        .get(`/pedidos/${pedidoA.body.id}`)
        .set("Authorization", `Bearer ${adminUser.idToken}`);
      expect(acessoAdmin.status).toBe(200);
    });

    it("GET /pedidos/:id inexistente -> 404", async () => {
      const res = await request(app)
        .get("/pedidos/id-que-nao-existe")
        .set("Authorization", `Bearer ${adminUser.idToken}`);
      expect(res.status).toBe(404);
    });
  });

  // Task 3.3.4
  describe("Transicoes de status pelo admin - RN05, RN07, RN07a", () => {
    it("sequencia pendente->confirmado->enviado->entregue e aceita", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });

      for (const status of ["confirmado", "enviado", "entregue"]) {
        const res = await request(app)
          .patch(`/pedidos/${pedido.body.id}/status`)
          .set("Authorization", `Bearer ${adminUser.idToken}`)
          .send({ status });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(status);
      }
    });

    it("transicao enviado->confirmado e rejeitada com 400", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });

      await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "confirmado" });
      await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "enviado" });

      const res = await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "confirmado" });

      expect(res.status).toBe(400);
    });

    it("nao-admin tentando mudar status recebe 403", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });

      const res = await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ status: "confirmado" });

      expect(res.status).toBe(403);
    });

    it("RN07a: admin cancelando pedido pendente RESTAURA estoque", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 4 }] });

      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "cancelado" });

      expect(res.status).toBe(200);
      expect(await lerEstoqueDireto(produtoId)).toBe(10);
    });

    it("RN07a: admin cancelando pedido confirmado NAO restaura estoque", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 4 }] });

      await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "confirmado" });

      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "cancelado" });

      expect(res.status).toBe(200);
      // Estoque permanece decrementado - ajuste manual, fora do escopo da Fase 1.
      expect(await lerEstoqueDireto(produtoId)).toBe(6);
    });

    it("RN07a: admin cancelando pedido enviado NAO restaura estoque", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 4 }] });

      await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "confirmado" });
      await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "enviado" });

      const res = await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "cancelado" });

      expect(res.status).toBe(200);
      expect(await lerEstoqueDireto(produtoId)).toBe(6);
    });
  });

  // Task 3.3.5
  describe("Cancelamento pelo cliente dono - RN06, RN08", () => {
    it("cliente dono cancela pedido pendente -> 200, status cancelado, estoque restaurado", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 3 }] });

      const res = await request(app)
        .patch(`/pedidos/${pedido.body.id}/cancelar`)
        .set("Authorization", `Bearer ${clienteA.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("cancelado");
      expect(await lerEstoqueDireto(produtoId)).toBe(10);
    });

    it("cliente tenta cancelar pedido fora de pendente -> 400", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });

      await request(app)
        .patch(`/pedidos/${pedido.body.id}/status`)
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ status: "confirmado" });

      const res = await request(app)
        .patch(`/pedidos/${pedido.body.id}/cancelar`)
        .set("Authorization", `Bearer ${clienteA.idToken}`);

      expect(res.status).toBe(400);
    });

    it("cliente cancelando pedido de outro cliente recebe 403", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });

      const res = await request(app)
        .patch(`/pedidos/${pedido.body.id}/cancelar`)
        .set("Authorization", `Bearer ${clienteB.idToken}`);

      expect(res.status).toBe(403);
    });
  });
});
