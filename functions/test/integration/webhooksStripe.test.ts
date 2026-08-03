// Este import DEVE vir antes de `../../src/app` para que o jest.mock virtual
// sobre "@/stripeClient" (helpers/mockStripe.ts) seja registrado antes de
// qualquer modulo do Modulo 5/6 tentar carregar o cliente Stripe real.
import {
  mockPaymentIntentsCreate,
  mockWebhooksConstructEvent,
  resetStripeMocks,
} from "../helpers/mockStripe";
import request from "supertest";
import app from "../../src/app";
import { createTestUser, TestUser } from "../helpers/testAuth";
import { clearFirestoreEmulator } from "../helpers/firestoreTestUtils";
import { getAdminApp } from "../helpers/adminApp";

/**
 * Testes de integracao do webhook `POST /webhooks/stripe` - RN11 a RN15
 * (Modulo 7 - Epicos 7.3 e 7.4).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): a rota `/webhooks/stripe` (Modulo 6
 * - Epico 6.1/6.2, `functions/src/routes/webhooks.routes.ts`) AINDA NAO
 * EXISTE e nao esta montada em `src/app.ts`. Toda requisicao abaixo recebera
 * 404 do Express, e os mocks do Stripe nunca serao chamados - esse e o
 * comportamento correto e esperado nesta fase.
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

async function lerPedidoDireto(pedidoId: string) {
  const snap = await getAdminApp().firestore().collection("pedidos").doc(pedidoId).get();
  return snap.exists ? snap.data() : undefined;
}

/**
 * Cria um pedido `pendente` com PaymentIntent mockada (fluxo RN10), pronto
 * para servir de alvo dos eventos de webhook simulados abaixo.
 */
async function criarPedidoPendente(
  clienteUser: TestUser,
  produtoId: string,
  quantidade: number,
): Promise<{ id: string; paymentIntentId: string }> {
  const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  mockPaymentIntentsCreate.mockResolvedValueOnce({
    id: paymentIntentId,
    client_secret: `${paymentIntentId}_secret`,
  });

  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${clienteUser.idToken}`)
    .send({ itens: [{ produtoId, quantidade }] });

  return { id: res.body.id, paymentIntentId };
}

function eventoSucceeded(eventId: string, pedidoId: string, paymentIntentId: string) {
  return {
    id: eventId,
    type: "payment_intent.succeeded",
    data: { object: { id: paymentIntentId, metadata: { pedidoId } } },
  };
}

function eventoFailed(eventId: string, pedidoId: string, paymentIntentId: string) {
  return {
    id: eventId,
    type: "payment_intent.payment_failed",
    data: { object: { id: paymentIntentId, metadata: { pedidoId } } },
  };
}

async function postWebhook(event: unknown, assinatura: string | null = "sig_valida_simulada") {
  const req = request(app).post("/webhooks/stripe").set("Content-Type", "application/json");
  if (assinatura !== null) {
    req.set("stripe-signature", assinatura);
  }
  return req.send(Buffer.from(JSON.stringify(event)));
}

describe("Webhook Stripe - RN11 a RN15 (Modulo 7 - Epicos 7.3/7.4)", () => {
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

  // Task 6.1.1 - pre-requisito estrutural de RN11.
  describe("Infra de rota publica com raw body (Task 6.1.1)", () => {
    it("RN11: req.body chega como Buffer cru dentro do handler do webhook (repassado a stripe.webhooks.constructEvent)", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 1);
      const event = eventoSucceeded("evt_raw_body", pedido.id, pedido.paymentIntentId);
      mockWebhooksConstructEvent.mockReturnValue(event);

      await postWebhook(event);

      expect(mockWebhooksConstructEvent).toHaveBeenCalledTimes(1);
      const primeiroArgumento = mockWebhooksConstructEvent.mock.calls[0][0];
      expect(Buffer.isBuffer(primeiroArgumento)).toBe(true);
    });

    it("regressao: POST /produtos continua recebendo req.body como JSON parseado normalmente", async () => {
      const res = await request(app)
        .post("/produtos")
        .set("Authorization", `Bearer ${adminUser.idToken}`)
        .send({ nome: "Regressao JSON", preco: 9.9, estoque: 3 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ nome: "Regressao JSON", preco: 9.9, estoque: 3 });
    });

    it("regressao: POST /pedidos continua recebendo req.body como JSON parseado normalmente", async () => {
      mockPaymentIntentsCreate.mockResolvedValue({
        id: "pi_regressao",
        client_secret: "secret_regressao",
      });
      const produtoId = await criarProduto(adminUser, { estoque: 5 });
      const res = await request(app)
        .post("/pedidos")
        .set("Authorization", `Bearer ${clienteA.idToken}`)
        .send({ itens: [{ produtoId, quantidade: 1 }] });
      expect(res.status).toBe(201);
      expect(res.body.itens).toHaveLength(1);
    });
  });

  // Task 7.3.1 - RN11
  describe("Validacao de assinatura - RN11", () => {
    it("assinatura ausente -> 400, nenhuma escrita em pedidos nem stripeEvents", async () => {
      const event = eventoSucceeded("evt_sem_assinatura", "qualquer-pedido", "pi_x");
      const res = await postWebhook(event, null);

      expect(res.status).toBe(400);
      expect(mockWebhooksConstructEvent).not.toHaveBeenCalled();
      const stripeEventsSnap = await getAdminApp().firestore().collection("stripeEvents").get();
      expect(stripeEventsSnap.size).toBe(0);
    });

    it("assinatura invalida (constructEvent lanca excecao) -> 400, nenhuma escrita em pedidos nem stripeEvents", async () => {
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error("assinatura invalida (simulado)");
      });
      const event = eventoSucceeded("evt_assinatura_invalida", "qualquer-pedido", "pi_x");

      const res = await postWebhook(event, "sig_invalida");

      expect(res.status).toBe(400);
      const stripeEventsSnap = await getAdminApp().firestore().collection("stripeEvents").get();
      expect(stripeEventsSnap.size).toBe(0);
      const pedidosSnap = await getAdminApp().firestore().collection("pedidos").get();
      expect(pedidosSnap.size).toBe(0);
    });
  });

  // Task 7.3.2 - RN12
  it("RN12: payment_intent.succeeded para pedido pendente -> confirmado, paymentStatus 'pago', resposta 200", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedido = await criarPedidoPendente(clienteA, produtoId, 2);

    const event = eventoSucceeded("evt_succeeded_1", pedido.id, pedido.paymentIntentId);
    mockWebhooksConstructEvent.mockReturnValue(event);

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    const pedidoDoc = await lerPedidoDireto(pedido.id);
    expect(pedidoDoc?.status).toBe("confirmado");
    expect(pedidoDoc?.paymentStatus).toBe("pago");
  });

  // Task 7.3.3 - RN13
  it("RN13: payment_intent.payment_failed para pedido pendente -> cancelado, estoque restaurado, resposta 200", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
    expect(await lerEstoqueDireto(produtoId)).toBe(6);

    const event = eventoFailed("evt_failed_1", pedido.id, pedido.paymentIntentId);
    mockWebhooksConstructEvent.mockReturnValue(event);

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    expect(await lerEstoqueDireto(produtoId)).toBe(10);
    const pedidoDoc = await lerPedidoDireto(pedido.id);
    expect(pedidoDoc?.status).toBe("cancelado");
    expect(pedidoDoc?.paymentStatus).toBe("falhou");
  });

  // Task 7.3.4 - RN15
  it("RN15: evento com metadata.pedidoId inexistente -> 200, nenhuma escrita em pedidos", async () => {
    const event = eventoSucceeded("evt_pedido_inexistente", "pedido-que-nao-existe", "pi_x");
    mockWebhooksConstructEvent.mockReturnValue(event);

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    const snap = await getAdminApp()
      .firestore()
      .collection("pedidos")
      .doc("pedido-que-nao-existe")
      .get();
    expect(snap.exists).toBe(false);
  });

  // Task 7.3.5 - RN15
  it("RN15: payment_intent.succeeded para pedido ja fora de 'pendente' -> 200, sem alteracao adicional", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedido = await criarPedidoPendente(clienteA, produtoId, 1);

    // Admin ja confirmou manualmente (fluxo Fase 1, inalterado) antes do evento atrasado chegar.
    await request(app)
      .patch(`/pedidos/${pedido.id}/status`)
      .set("Authorization", `Bearer ${adminUser.idToken}`)
      .send({ status: "confirmado" });

    const antes = await lerPedidoDireto(pedido.id);

    const event = eventoSucceeded("evt_atrasado", pedido.id, pedido.paymentIntentId);
    mockWebhooksConstructEvent.mockReturnValue(event);
    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    const depois = await lerPedidoDireto(pedido.id);
    expect(depois?.status).toBe("confirmado");
    // paymentStatus nao deve ser alterado retroativamente por um evento
    // atrasado processado fora de 'pendente' (RN15: noop de dominio).
    expect(depois?.paymentStatus).toBe(antes?.paymentStatus);
  });

  // Task 7.4.1 - RN14
  it("RN14: reenvio do mesmo event.id (succeeded duplicado) nao dispara segunda transicao de status", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedido = await criarPedidoPendente(clienteA, produtoId, 1);

    const event = eventoSucceeded("evt_dup_succeeded", pedido.id, pedido.paymentIntentId);
    mockWebhooksConstructEvent.mockReturnValue(event);

    const res1 = await postWebhook(event);
    expect(res1.status).toBe(200);
    const apos1a = await lerPedidoDireto(pedido.id);
    expect(apos1a?.status).toBe("confirmado");

    const res2 = await postWebhook(event);
    expect(res2.status).toBe(200);
    const apos2a = await lerPedidoDireto(pedido.id);
    // Nenhuma segunda transicao: updatedAt/status inalterados pela reentrega.
    expect(apos2a?.status).toBe("confirmado");
    expect(apos2a?.updatedAt).toEqual(apos1a?.updatedAt);

    const stripeEventsSnap = await getAdminApp()
      .firestore()
      .collection("stripeEvents")
      .where("eventId", "==", "evt_dup_succeeded")
      .get();
    expect(stripeEventsSnap.size).toBe(1);
  });

  // Task 7.4.2 - RN14
  it("RN14: reenvio do mesmo event.id (payment_failed duplicado) nao restaura estoque duas vezes", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
    expect(await lerEstoqueDireto(produtoId)).toBe(6);

    const event = eventoFailed("evt_dup_failed", pedido.id, pedido.paymentIntentId);
    mockWebhooksConstructEvent.mockReturnValue(event);

    const res1 = await postWebhook(event);
    expect(res1.status).toBe(200);
    expect(await lerEstoqueDireto(produtoId)).toBe(10);

    const res2 = await postWebhook(event);
    expect(res2.status).toBe(200);
    // Estoque nao pode ultrapassar o valor original restaurado uma unica vez.
    expect(await lerEstoqueDireto(produtoId)).toBe(10);

    const stripeEventsSnap = await getAdminApp()
      .firestore()
      .collection("stripeEvents")
      .where("eventId", "==", "evt_dup_failed")
      .get();
    expect(stripeEventsSnap.size).toBe(1);
  });

  // Task 6.4.5 - eventos de tipo nao mapeado
  it("evento de tipo nao mapeado (ex.: charge.refunded) -> 200, nenhuma escrita em pedidos, registrado em stripeEvents", async () => {
    const event = {
      id: "evt_tipo_desconhecido",
      type: "charge.refunded",
      data: { object: { id: "ch_x", metadata: {} } },
    };
    mockWebhooksConstructEvent.mockReturnValue(event);

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    const pedidosSnap = await getAdminApp().firestore().collection("pedidos").get();
    expect(pedidosSnap.size).toBe(0);
    const stripeEventsSnap = await getAdminApp()
      .firestore()
      .collection("stripeEvents")
      .where("eventId", "==", "evt_tipo_desconhecido")
      .get();
    expect(stripeEventsSnap.size).toBe(1);
  });
});
