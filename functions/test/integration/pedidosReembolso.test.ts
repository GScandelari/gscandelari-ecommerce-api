// Este import DEVE vir antes de `../../src/app` para que o jest.mock virtual
// sobre "@/stripeClient" (helpers/mockStripe.ts) seja registrado antes de
// qualquer modulo do Modulo 20 (AINDA NAO IMPLEMENTADO) tentar carregar o
// cliente Stripe real.
import {
  mockPaymentIntentsCreate,
  mockRefundsCreate,
  mockWebhooksConstructEvent,
  resetStripeMocks,
} from "../helpers/mockStripe";
import request from "supertest";
import app from "../../src/app";
import { createTestUser, TestUser } from "../helpers/testAuth";
import { clearFirestoreEmulator } from "../helpers/firestoreTestUtils";
import { getAdminApp } from "../helpers/adminApp";

/**
 * Testes do endpoint `PATCH /pedidos/:id/reembolsar` - RN32 (Fase 5,
 * Modulo 22 - Epico 22.5).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): a rota `/pedidos/:id/reembolsar` e
 * o servico `reembolsarPedido` (Modulo 20, AINDA NAO IMPLEMENTADOS) nao
 * existem em `pedidos.routes.ts`/`pedidosService.ts`. Toda requisicao
 * abaixo recebera 404 do Express (rota inexistente), e o mock de
 * `stripe.refunds.create` nunca sera chamado - esse e o comportamento
 * correto e esperado nesta fase.
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
): Promise<{ id: string; paymentIntentId: string; total: number }> {
  const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  mockPaymentIntentsCreate.mockResolvedValueOnce({
    id: paymentIntentId,
    client_secret: `${paymentIntentId}_secret`,
  });

  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${clienteUser.idToken}`)
    .send({ itens: [{ produtoId, quantidade }] });

  return { id: res.body.id, paymentIntentId, total: res.body.total };
}

async function marcarComoPago(pedidoId: string, paymentIntentId: string): Promise<void> {
  const event = {
    id: `evt_pago_${pedidoId}`,
    type: "payment_intent.succeeded",
    data: { object: { id: paymentIntentId, metadata: { pedidoId } } },
  };
  mockWebhooksConstructEvent.mockReturnValueOnce(event);
  const res = await request(app)
    .post("/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("stripe-signature", "sig_valida_simulada")
    .send(Buffer.from(JSON.stringify(event)));
  if (res.status !== 200) {
    throw new Error(
      `Falha ao preparar fixture de teste (marcarComoPago): webhook retornou ${res.status}.`,
    );
  }
}

/**
 * Fixture de topo: cria um pedido, leva-o a `paymentStatus: "pago"`
 * (confirmado) e o cancela pelo cliente (RN28) - caminho minimo ate
 * `paymentStatus: "estorno_pendente"` (RN31), pronto para exercitar o
 * endpoint de reembolso (RN32).
 */
async function criarPedidoEstornoPendente(
  clienteUser: TestUser,
  produtoId: string,
  quantidade = 2,
): Promise<{ id: string; paymentIntentId: string; total: number }> {
  const pedido = await criarPedidoPendente(clienteUser, produtoId, quantidade);
  await marcarComoPago(pedido.id, pedido.paymentIntentId);
  const cancelRes = await request(app)
    .patch(`/pedidos/${pedido.id}/cancelar`)
    .set("Authorization", `Bearer ${clienteUser.idToken}`);
  if (cancelRes.status !== 200 || cancelRes.body.paymentStatus !== "estorno_pendente") {
    throw new Error(
      "Falha ao preparar fixture de teste (criarPedidoEstornoPendente): " +
        `cancelamento retornou status=${cancelRes.status}, paymentStatus=${cancelRes.body?.paymentStatus}. ` +
        "Depende do Modulo 19 (cancelamento estendido) ja estar implementado.",
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

describe("PATCH /pedidos/:id/reembolsar - RN32 (Fase 5, Modulo 22 - Epico 22.5)", () => {
  let adminUser: TestUser;
  let clienteA: TestUser;

  beforeAll(async () => {
    await clearFirestoreEmulator();
    adminUser = await createTestUser({ admin: true });
    clienteA = await createTestUser({ admin: false });
  });

  beforeEach(() => {
    resetStripeMocks();
  });

  afterEach(async () => {
    await clearFirestoreEmulator();
  });

  // Task 22.5.1
  it("RN32: sucesso - refunds.create mockada -> 200, paymentStatus vira 'reembolsado', status do pedido inalterado", async () => {
    const produtoId = await criarProduto(adminUser, { preco: 25, estoque: 10 });
    const pedido = await criarPedidoEstornoPendente(clienteA, produtoId, 2); // total = 50

    mockRefundsCreate.mockResolvedValue({ id: "re_test_1", status: "succeeded" });

    const res = await reembolsar(adminUser, pedido.id);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("reembolsado");
    expect(res.body.status).toBe("cancelado");

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: pedido.paymentIntentId,
        amount: Math.round(pedido.total * 100),
      }),
    );

    const depois = await lerPedidoDireto(pedido.id);
    expect(depois?.paymentStatus).toBe("reembolsado");
    expect(depois?.status).toBe("cancelado");
  });

  // Task 22.5.2
  it("RN32: falha do Stripe (refunds.create rejeitada) -> 502, paymentStatus permanece 'estorno_pendente'", async () => {
    const produtoId = await criarProduto(adminUser, { preco: 30, estoque: 10 });
    const pedido = await criarPedidoEstornoPendente(clienteA, produtoId, 1);

    mockRefundsCreate.mockRejectedValue(new Error("stripe indisponivel (simulado)"));

    const res = await reembolsar(adminUser, pedido.id);

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      error: { code: expect.any(String), message: expect.any(String) },
    });

    // Permite nova tentativa: paymentStatus nao regride nem avanca em falha.
    const depois = await lerPedidoDireto(pedido.id);
    expect(depois?.paymentStatus).toBe("estorno_pendente");
    expect(depois?.status).toBe("cancelado");
  });

  // Task 22.5.3
  describe("Precondicao de estado: paymentStatus diferente de 'estorno_pendente' -> 400, sem chamada ao Stripe", () => {
    it("paymentStatus 'aguardando_pagamento' (pedido pendente, nunca cancelado) -> 400", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 1);

      const res = await reembolsar(adminUser, pedido.id);

      expect(res.status).toBe(400);
      expect(mockRefundsCreate).not.toHaveBeenCalled();
    });

    it("paymentStatus 'pago' (pedido confirmado, ainda nao cancelado) -> 400", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 1);
      await marcarComoPago(pedido.id, pedido.paymentIntentId);

      const res = await reembolsar(adminUser, pedido.id);

      expect(res.status).toBe(400);
      expect(mockRefundsCreate).not.toHaveBeenCalled();
    });

    it("paymentStatus 'falhou' (pedido cancelado por falha de pagamento, RN13) -> 400", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_falha_reembolso",
        client_secret: "secret_falha_reembolso",
      });
      const pedidoRes = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });

      const event = {
        id: "evt_falhou_reembolso",
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_falha_reembolso", metadata: { pedidoId: pedidoRes.body.id } } },
      };
      mockWebhooksConstructEvent.mockReturnValueOnce(event);
      await request(app)
        .post("/webhooks/stripe")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "sig_valida_simulada")
        .send(Buffer.from(JSON.stringify(event)));

      const res = await reembolsar(adminUser, pedidoRes.body.id);

      expect(res.status).toBe(400);
      expect(mockRefundsCreate).not.toHaveBeenCalled();
    });

    it("paymentStatus 'reembolsado' (reembolso ja processado anteriormente) -> 400", async () => {
      const produtoId = await criarProduto(adminUser, { preco: 10, estoque: 10 });
      const pedido = await criarPedidoEstornoPendente(clienteA, produtoId, 1);
      mockRefundsCreate.mockResolvedValueOnce({ id: "re_ja_processado", status: "succeeded" });
      const primeiraTentativa = await reembolsar(adminUser, pedido.id);
      expect(primeiraTentativa.status).toBe(200);
      expect(primeiraTentativa.body.paymentStatus).toBe("reembolsado");

      mockRefundsCreate.mockClear();
      const segundaTentativa = await reembolsar(adminUser, pedido.id);

      expect(segundaTentativa.status).toBe(400);
      expect(mockRefundsCreate).not.toHaveBeenCalled();
    });
  });

  // Task 22.5.4
  //
  // Deliberadamente usa apenas `criarPedidoPendente` (nao a fixture
  // `criarPedidoEstornoPendente`, que depende do Modulo 19 ja estar
  // implementado): a checagem de autorizacao (`requireAdmin`) e esperada
  // ocorrer ANTES de qualquer verificacao de `paymentStatus` (mesmo padrao
  // ja usado nas demais rotas admin-only, Fase 1) - entao estes 2 testes
  // devem falhar/passar exclusivamente pela presenca (ou nao) do middleware
  // de autorizacao, sem acoplar a outro modulo ainda nao implementado.
  describe("Autorizacao - admin-only", () => {
    it("nao-admin tentando solicitar reembolso recebe 403, sem chamada ao Stripe", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 1);

      const res = await reembolsar(clienteA, pedido.id);

      expect(res.status).toBe(403);
      expect(mockRefundsCreate).not.toHaveBeenCalled();
    });

    it("requisicao sem token recebe 401, sem chamada ao Stripe", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 1);

      const res = await reembolsar(null, pedido.id);

      expect(res.status).toBe(401);
      expect(mockRefundsCreate).not.toHaveBeenCalled();
    });
  });
});
