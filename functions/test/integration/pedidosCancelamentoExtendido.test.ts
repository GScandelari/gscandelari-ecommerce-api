// Este import DEVE vir antes de `../../src/app` para que o jest.mock virtual
// sobre "@/stripeClient" (helpers/mockStripe.ts) seja registrado antes de
// qualquer modulo do Modulo 5/6/18/19/20 tentar carregar o cliente Stripe
// real.
import { mockPaymentIntentsCreate, mockWebhooksConstructEvent, resetStripeMocks } from "../helpers/mockStripe";
import request from "supertest";
import app from "../../src/app";
import { createTestUser, TestUser } from "../helpers/testAuth";
import { clearFirestoreEmulator } from "../helpers/firestoreTestUtils";
import { getAdminApp } from "../helpers/adminApp";

/**
 * Testes de cancelamento pos-pagamento estendido - RN28, RN29, RN30, RN31,
 * regressao explicita de RN07a (Fase 5, Modulo 22 - Epicos 22.3 e 22.4).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): os Modulos 18/19 (novo valor
 * `aguardando_devolucao` em PedidoStatus, novos valores `estorno_pendente`/
 * `reembolsado` em PaymentStatus, extensao de `cancelarPedidoCliente` e
 * `alterarStatusAdmin`) AINDA NAO ESTAO IMPLEMENTADOS. Praticamente toda
 * asserção abaixo falhará contra o comportamento herdado da Fase 1+2 (ex.:
 * cliente cancelando `confirmado` ainda retorna 400 em vez de 200; "cancelar"
 * a partir de `enviado` ainda nao existe como conceito) - esse e o
 * comportamento correto e esperado nesta fase (TDD "vermelho").
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
 * Cria um pedido `pendente` com PaymentIntent mockada (fluxo RN10, mesmo
 * padrao ja usado em pedidosPagamento.test.ts/webhooksStripe.test.ts).
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

/**
 * Leva um pedido `pendente` ate `confirmado` com `paymentStatus: "pago"`,
 * disparando o webhook `payment_intent.succeeded` (mesmo mecanismo real de
 * RN12, ja coberto em webhooksStripe.test.ts) - reutilizado aqui porque os
 * cenarios de RN31 desta suite dependem especificamente de um pedido cujo
 * pagamento ja foi confirmado ("pago"), nao apenas "aguardando_pagamento".
 */
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

async function alterarStatusAdmin(
  adminUser: TestUser,
  pedidoId: string,
  status: string,
) {
  return request(app)
    .patch(`/pedidos/${pedidoId}/status`)
    .set("Authorization", `Bearer ${adminUser.idToken}`)
    .send({ status });
}

async function cancelarComoCliente(clienteUser: TestUser, pedidoId: string) {
  return request(app)
    .patch(`/pedidos/${pedidoId}/cancelar`)
    .set("Authorization", `Bearer ${clienteUser.idToken}`);
}

describe("Cancelamento pos-pagamento estendido - RN28-RN31, RN07a (Fase 5, Modulo 22 - Epicos 22.3/22.4)", () => {
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

  // ---------------------------------------------------------------------
  // Epico 22.3: Cliente - RN28, RN29
  // ---------------------------------------------------------------------
  describe("Cliente - RN28, RN29", () => {
    // Task 22.3.1
    it("RN28: cliente dono cancela pedido confirmado -> 200, status cancelado, estoque restaurado", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 3);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      expect(await lerEstoqueDireto(produtoId)).toBe(7);

      const res = await cancelarComoCliente(clienteA, pedido.id);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("cancelado");
      expect(await lerEstoqueDireto(produtoId)).toBe(10);
    });

    // Task 22.3.2
    it("RN31: cliente cancela pedido confirmado com paymentStatus 'pago' -> paymentStatus vira 'estorno_pendente'", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 2);
      await marcarComoPago(pedido.id, pedido.paymentIntentId);
      const antes = await lerPedidoDireto(pedido.id);
      expect(antes?.status).toBe("confirmado");
      expect(antes?.paymentStatus).toBe("pago");

      const res = await cancelarComoCliente(clienteA, pedido.id);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("cancelado");
      expect(res.body.paymentStatus).toBe("estorno_pendente");
      const depois = await lerPedidoDireto(pedido.id);
      expect(depois?.paymentStatus).toBe("estorno_pendente");
    });

    // Task 22.3.3
    it("RN31: cliente cancela pedido pendente com paymentStatus 'aguardando_pagamento' -> paymentStatus permanece inalterado", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 2);
      const antes = await lerPedidoDireto(pedido.id);
      expect(antes?.status).toBe("pendente");
      expect(antes?.paymentStatus).toBe("aguardando_pagamento");

      const res = await cancelarComoCliente(clienteA, pedido.id);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("cancelado");
      // Nunca vira "estorno_pendente" a partir de pendente - nao ha cobranca
      // confirmada ainda.
      expect(res.body.paymentStatus).toBe("aguardando_pagamento");
    });

    // Task 22.3.4
    it("RN29: cliente 'cancela' pedido enviado -> 200, status vira aguardando_devolucao, estoque e paymentStatus inalterados", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      await alterarStatusAdmin(adminUser, pedido.id, "enviado");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await cancelarComoCliente(clienteA, pedido.id);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("aguardando_devolucao");
      // Produto ainda fisicamente com o cliente - nao e um cancelamento
      // efetivo ainda, entao nem estoque nem paymentStatus mudam.
      expect(await lerEstoqueDireto(produtoId)).toBe(6);
      const depois = await lerPedidoDireto(pedido.id);
      expect(depois?.paymentStatus).toBe("aguardando_pagamento");
    });

    // Task 22.3.5
    describe("Limite de RN29: cliente nao pode cancelar a partir de aguardando_devolucao, entregue ou cancelado", () => {
      it("cliente tenta cancelar pedido em aguardando_devolucao -> 400, sem alteracao no Firestore", async () => {
        const produtoId = await criarProduto(adminUser, { estoque: 10 });
        const pedido = await criarPedidoPendente(clienteA, produtoId, 1);
        await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
        await alterarStatusAdmin(adminUser, pedido.id, "enviado");
        await cancelarComoCliente(clienteA, pedido.id); // -> aguardando_devolucao (RN29)
        const antes = await lerPedidoDireto(pedido.id);
        expect(antes?.status).toBe("aguardando_devolucao");

        const res = await cancelarComoCliente(clienteA, pedido.id);

        expect(res.status).toBe(400);
        const depois = await lerPedidoDireto(pedido.id);
        expect(depois?.status).toBe("aguardando_devolucao");
        expect(depois?.updatedAt).toEqual(antes?.updatedAt);
      });

      it("cliente tenta cancelar pedido entregue -> 400, sem alteracao no Firestore", async () => {
        const produtoId = await criarProduto(adminUser, { estoque: 10 });
        const pedido = await criarPedidoPendente(clienteA, produtoId, 1);
        for (const status of ["confirmado", "enviado", "entregue"]) {
          await alterarStatusAdmin(adminUser, pedido.id, status);
        }
        const antes = await lerPedidoDireto(pedido.id);
        expect(antes?.status).toBe("entregue");

        const res = await cancelarComoCliente(clienteA, pedido.id);

        expect(res.status).toBe(400);
        const depois = await lerPedidoDireto(pedido.id);
        expect(depois?.status).toBe("entregue");
        expect(depois?.updatedAt).toEqual(antes?.updatedAt);
      });

      it("cliente tenta cancelar pedido ja cancelado -> 400, sem alteracao no Firestore", async () => {
        const produtoId = await criarProduto(adminUser, { estoque: 10 });
        const pedido = await criarPedidoPendente(clienteA, produtoId, 1);
        await cancelarComoCliente(clienteA, pedido.id); // -> cancelado (pendente, RN06)
        const antes = await lerPedidoDireto(pedido.id);
        expect(antes?.status).toBe("cancelado");

        const res = await cancelarComoCliente(clienteA, pedido.id);

        expect(res.status).toBe(400);
        const depois = await lerPedidoDireto(pedido.id);
        expect(depois?.status).toBe("cancelado");
        expect(depois?.updatedAt).toEqual(antes?.updatedAt);
      });
    });
  });

  // ---------------------------------------------------------------------
  // Epico 22.4: Admin - RN29, RN30, RN31, regressao de RN07a
  // ---------------------------------------------------------------------
  describe("Admin - RN29, RN30, RN31, regressao de RN07a", () => {
    // Task 22.4.1
    it("RN29: admin transiciona enviado->aguardando_devolucao -> 200, sem alteracao de estoque/paymentStatus", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      await alterarStatusAdmin(adminUser, pedido.id, "enviado");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await alterarStatusAdmin(adminUser, pedido.id, "aguardando_devolucao");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("aguardando_devolucao");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);
      const depois = await lerPedidoDireto(pedido.id);
      expect(depois?.paymentStatus).toBe("aguardando_pagamento");
    });

    // Task 22.4.2
    it("RN30: admin transiciona aguardando_devolucao->cancelado -> 200, estoque restaurado", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      await alterarStatusAdmin(adminUser, pedido.id, "enviado");
      await alterarStatusAdmin(adminUser, pedido.id, "aguardando_devolucao");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await alterarStatusAdmin(adminUser, pedido.id, "cancelado");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("cancelado");
      expect(await lerEstoqueDireto(produtoId)).toBe(10);
    });

    // Task 22.4.3
    it("RN31: admin confirma aguardando_devolucao->cancelado com paymentStatus 'pago' -> vira 'estorno_pendente'", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 1);
      await marcarComoPago(pedido.id, pedido.paymentIntentId); // -> confirmado, pago
      await alterarStatusAdmin(adminUser, pedido.id, "enviado");
      await alterarStatusAdmin(adminUser, pedido.id, "aguardando_devolucao");

      const res = await alterarStatusAdmin(adminUser, pedido.id, "cancelado");

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe("estorno_pendente");
      const depois = await lerPedidoDireto(pedido.id);
      expect(depois?.paymentStatus).toBe("estorno_pendente");
    });

    // Task 22.4.4
    it("RN07a (regressao explicita): admin cancelando pedido confirmado NAO restaura estoque - assimetria Cliente/Admin preservada (RN28 e exclusiva do Cliente)", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await alterarStatusAdmin(adminUser, pedido.id, "cancelado");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("cancelado");
      // Comportamento herdado da Fase 1 (RN07a), inalterado: RN28 (Fase 5)
      // fala exclusivamente do Cliente, entao a extensao NAO vaza para o
      // caminho do Admin cancelando um pedido confirmado.
      expect(await lerEstoqueDireto(produtoId)).toBe(6);
    });

    // Task 22.4.5
    it("RN29/RN33: admin tentando transicionar diretamente enviado->cancelado recebe 400 (transicao nao mais estruturalmente valida)", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 1);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      await alterarStatusAdmin(adminUser, pedido.id, "enviado");

      const res = await alterarStatusAdmin(adminUser, pedido.id, "cancelado");

      expect(res.status).toBe(400);
      const depois = await lerPedidoDireto(pedido.id);
      expect(depois?.status).toBe("enviado");
    });
  });
});
