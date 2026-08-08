import {
  mockCriarPaymentIntent,
  mockReembolsarPagamento,
  resetPaymentsInternalClientMocks,
} from "../helpers/mockPaymentsInternalClient";
import {
  resetMockVerifyInternalToken,
  setInternalTokenValido,
} from "../helpers/mockVerifyInternalToken";
import request from "supertest";
import app from "../../src/app";
import { createTestUser, TestUser } from "../helpers/testAuth";
import { clearFirestoreEmulator } from "../helpers/firestoreTestUtils";
import { getAdminApp } from "../helpers/adminApp";

/**
 * Testes do endpoint `PATCH /pedidos/:id/reembolsar` (Orders) - RN32 (Fase
 * 5, Modulo 22.7 - replicacao de pedidosReembolso.test.ts de `functions/`).
 * Decisao tecnica 6: Orders nunca fala com o Stripe diretamente - a chamada
 * de rede fica inteiramente atras do cliente HTTP interno para Payments
 * (`payments.internalClient.ts`), mockado aqui na fronteira.
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

async function lerPedidoDireto(pedidoId: string) {
  const snap = await getAdminApp().firestore().collection("pedidos").doc(pedidoId).get();
  return snap.exists ? snap.data() : undefined;
}

async function criarPedidoPendente(
  clienteUser: TestUser,
  produtoId: string,
  quantidade: number,
): Promise<{ id: string; total: number }> {
  const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  mockCriarPaymentIntent.mockResolvedValueOnce({
    paymentIntentId,
    clientSecret: `${paymentIntentId}_secret`,
  });

  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${clienteUser.idToken}`)
    .send({ itens: [{ produtoId, quantidade }] });

  return { id: res.body.id, total: res.body.total };
}

async function marcarComoPago(pedidoId: string): Promise<void> {
  setInternalTokenValido(true);
  await request(app)
    .post(`/internal/pedidos/${pedidoId}/confirmar-pagamento`)
    .set("Authorization", "Bearer token-interno-valido-de-payments")
    .send({});
}

async function criarPedidoEstornoPendente(
  clienteUser: TestUser,
  produtoId: string,
  quantidade = 2,
): Promise<{ id: string; total: number }> {
  const pedido = await criarPedidoPendente(clienteUser, produtoId, quantidade);
  await marcarComoPago(pedido.id);
  const cancelRes = await request(app)
    .patch(`/pedidos/${pedido.id}/cancelar`)
    .set("Authorization", `Bearer ${clienteUser.idToken}`);
  if (cancelRes.status !== 200 || cancelRes.body.paymentStatus !== "estorno_pendente") {
    throw new Error(
      "Falha ao preparar fixture de teste (criarPedidoEstornoPendente): " +
        `cancelamento retornou status=${cancelRes.status}, paymentStatus=${cancelRes.body?.paymentStatus}.`,
    );
  }
  return pedido;
}

async function reembolsar(adminUser: TestUser | null, pedidoId: string) {
  const req = request(app).patch(`/pedidos/${pedidoId}/reembolsar`);
  if (adminUser) {
    req.set("Authorization", `Bearer ${adminUser.idToken}`);
  }
  return req.send();
}

describe("PATCH /pedidos/:id/reembolsar (Orders) - RN32 (Fase 5, Modulo 22.7)", () => {
  let adminUser: TestUser;
  let clienteA: TestUser;

  beforeAll(async () => {
    await clearFirestoreEmulator();
    adminUser = await createTestUser({ admin: true });
    clienteA = await createTestUser({ admin: false });
  });

  beforeEach(() => {
    resetPaymentsInternalClientMocks();
    resetMockVerifyInternalToken();
  });

  afterEach(async () => {
    await clearFirestoreEmulator();
  });

  it("RN32: sucesso - reembolsarPagamento (internalClient) mockado -> 200, paymentStatus vira 'reembolsado'", async () => {
    const produtoId = await criarProduto(adminUser, { preco: 25, estoque: 10 });
    const pedido = await criarPedidoEstornoPendente(clienteA, produtoId, 2); // total = 50
    mockReembolsarPagamento.mockResolvedValue(undefined);

    const res = await reembolsar(adminUser, pedido.id);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("reembolsado");
    expect(res.body.status).toBe("cancelado");
    expect(mockReembolsarPagamento).toHaveBeenCalledWith(
      expect.any(String),
      Math.round(pedido.total * 100),
    );

    const depois = await lerPedidoDireto(pedido.id);
    expect(depois?.paymentStatus).toBe("reembolsado");
  });

  it("RN32: falha na chamada interna a Payments -> 502, paymentStatus permanece 'estorno_pendente'", async () => {
    const produtoId = await criarProduto(adminUser, { preco: 30, estoque: 10 });
    const pedido = await criarPedidoEstornoPendente(clienteA, produtoId, 1);
    mockReembolsarPagamento.mockRejectedValue(new Error("Payments indisponivel (simulado)"));

    const res = await reembolsar(adminUser, pedido.id);

    expect(res.status).toBe(502);
    const depois = await lerPedidoDireto(pedido.id);
    expect(depois?.paymentStatus).toBe("estorno_pendente");
    expect(depois?.status).toBe("cancelado");
  });

  it("paymentStatus 'aguardando_pagamento' (pedido pendente, nunca cancelado) -> 400", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedido = await criarPedidoPendente(clienteA, produtoId, 1);

    const res = await reembolsar(adminUser, pedido.id);

    expect(res.status).toBe(400);
    expect(mockReembolsarPagamento).not.toHaveBeenCalled();
  });

  it("paymentStatus 'pago' (pedido confirmado, ainda nao cancelado) -> 400", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedido = await criarPedidoPendente(clienteA, produtoId, 1);
    await marcarComoPago(pedido.id);

    const res = await reembolsar(adminUser, pedido.id);

    expect(res.status).toBe(400);
    expect(mockReembolsarPagamento).not.toHaveBeenCalled();
  });

  it("nao-admin tentando solicitar reembolso recebe 403, sem chamada interna", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedido = await criarPedidoPendente(clienteA, produtoId, 1);

    const res = await reembolsar(clienteA, pedido.id);

    expect(res.status).toBe(403);
    expect(mockReembolsarPagamento).not.toHaveBeenCalled();
  });

  it("requisicao sem token recebe 401, sem chamada interna", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedido = await criarPedidoPendente(clienteA, produtoId, 1);

    const res = await reembolsar(null, pedido.id);

    expect(res.status).toBe(401);
    expect(mockReembolsarPagamento).not.toHaveBeenCalled();
  });
});
