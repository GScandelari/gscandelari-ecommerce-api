// Este import DEVE vir antes de `../../src/app` (mesmo motivo de
// pedidos.test.ts/internalRoutes.test.ts - Orders chama Payments via
// cliente HTTP interno na criacao do pedido, RN16).
import {
  mockCriarPaymentIntent,
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
 * Testes de cancelamento pos-pagamento estendido - RN28, RN29, RN30, RN31,
 * regressao de RN07a (Fase 5, Modulo 22.7 - replicacao de
 * pedidosCancelamentoExtendido.test.ts de `functions/`, adaptado para a
 * arquitetura multi-servico da Fase 3: "pago" e simulado chamando o
 * endpoint interno `/internal/pedidos/:id/confirmar-pagamento` diretamente
 * - o mesmo endpoint que Payments chamaria de verdade ao processar o
 * webhook do Stripe, ja coberto isoladamente em internalRoutes.test.ts).
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

async function criarPedidoPendente(
  clienteUser: TestUser,
  produtoId: string,
  quantidade: number,
): Promise<{ id: string; paymentIntentId: string }> {
  const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  mockCriarPaymentIntent.mockResolvedValueOnce({
    paymentIntentId,
    clientSecret: `${paymentIntentId}_secret`,
  });

  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${clienteUser.idToken}`)
    .send({ itens: [{ produtoId, quantidade }] });

  return { id: res.body.id, paymentIntentId };
}

/** Simula o efeito do webhook do Stripe (via Payments) sobre um pedido, chamando o endpoint interno diretamente (RN17). */
async function marcarComoPago(pedidoId: string): Promise<void> {
  setInternalTokenValido(true);
  const res = await request(app)
    .post(`/internal/pedidos/${pedidoId}/confirmar-pagamento`)
    .set("Authorization", "Bearer token-interno-valido-de-payments")
    .send({});
  if (res.status !== 200) {
    throw new Error(
      `Falha ao preparar fixture de teste (marcarComoPago): endpoint interno retornou ${res.status}.`,
    );
  }
}

async function alterarStatusAdmin(adminUser: TestUser, pedidoId: string, status: string) {
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

describe("Cancelamento pos-pagamento estendido - RN28-RN31, RN07a (Fase 5, Modulo 22.7)", () => {
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

  describe("Cliente - RN28, RN29", () => {
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

    it("RN31: cliente cancela pedido confirmado com paymentStatus 'pago' -> paymentStatus vira 'estorno_pendente'", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 2);
      await marcarComoPago(pedido.id);
      const antes = await lerPedidoDireto(pedido.id);
      expect(antes?.status).toBe("confirmado");
      expect(antes?.paymentStatus).toBe("pago");

      const res = await cancelarComoCliente(clienteA, pedido.id);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe("estorno_pendente");
      const depois = await lerPedidoDireto(pedido.id);
      expect(depois?.paymentStatus).toBe("estorno_pendente");
    });

    it("RN31: cliente cancela pedido pendente com paymentStatus 'aguardando_pagamento' -> paymentStatus permanece inalterado", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 2);

      const res = await cancelarComoCliente(clienteA, pedido.id);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe("aguardando_pagamento");
    });

    it("RN29: cliente 'cancela' pedido enviado -> 200, status vira aguardando_devolucao, estoque e paymentStatus inalterados", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      await alterarStatusAdmin(adminUser, pedido.id, "enviado");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await cancelarComoCliente(clienteA, pedido.id);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("aguardando_devolucao");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);
      const depois = await lerPedidoDireto(pedido.id);
      expect(depois?.paymentStatus).toBe("aguardando_pagamento");
    });

    it("cliente tenta cancelar pedido em aguardando_devolucao/entregue/cancelado -> 400 nos 3 casos", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });

      const pedido1 = await criarPedidoPendente(clienteA, produtoId, 1);
      await alterarStatusAdmin(adminUser, pedido1.id, "confirmado");
      await alterarStatusAdmin(adminUser, pedido1.id, "enviado");
      await cancelarComoCliente(clienteA, pedido1.id); // -> aguardando_devolucao
      expect((await cancelarComoCliente(clienteA, pedido1.id)).status).toBe(400);

      const pedido2 = await criarPedidoPendente(clienteA, produtoId, 1);
      for (const status of ["confirmado", "enviado", "entregue"]) {
        await alterarStatusAdmin(adminUser, pedido2.id, status);
      }
      expect((await cancelarComoCliente(clienteA, pedido2.id)).status).toBe(400);

      const pedido3 = await criarPedidoPendente(clienteA, produtoId, 1);
      await cancelarComoCliente(clienteA, pedido3.id); // -> cancelado (pendente, RN06)
      expect((await cancelarComoCliente(clienteA, pedido3.id)).status).toBe(400);
    });
  });

  describe("Admin - RN29, RN30, RN31, regressao de RN07a", () => {
    it("RN29: admin transiciona enviado->aguardando_devolucao -> 200, sem alteracao de estoque/paymentStatus", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      await alterarStatusAdmin(adminUser, pedido.id, "enviado");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await alterarStatusAdmin(adminUser, pedido.id, "aguardando_devolucao");

      expect(res.status).toBe(200);
      expect(await lerEstoqueDireto(produtoId)).toBe(6);
    });

    it("RN30: admin transiciona aguardando_devolucao->cancelado -> 200, estoque restaurado", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      await alterarStatusAdmin(adminUser, pedido.id, "enviado");
      await alterarStatusAdmin(adminUser, pedido.id, "aguardando_devolucao");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await alterarStatusAdmin(adminUser, pedido.id, "cancelado");

      expect(res.status).toBe(200);
      expect(await lerEstoqueDireto(produtoId)).toBe(10);
    });

    it("RN31: admin confirma aguardando_devolucao->cancelado com paymentStatus 'pago' -> vira 'estorno_pendente'", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 1);
      await marcarComoPago(pedido.id);
      await alterarStatusAdmin(adminUser, pedido.id, "enviado");
      await alterarStatusAdmin(adminUser, pedido.id, "aguardando_devolucao");

      const res = await alterarStatusAdmin(adminUser, pedido.id, "cancelado");

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe("estorno_pendente");
    });

    it("RN07a (regressao explicita): admin cancelando pedido confirmado NAO restaura estoque", async () => {
      const produtoId = await criarProduto(adminUser, { estoque: 10 });
      const pedido = await criarPedidoPendente(clienteA, produtoId, 4);
      await alterarStatusAdmin(adminUser, pedido.id, "confirmado");
      expect(await lerEstoqueDireto(produtoId)).toBe(6);

      const res = await alterarStatusAdmin(adminUser, pedido.id, "cancelado");

      expect(res.status).toBe(200);
      expect(await lerEstoqueDireto(produtoId)).toBe(6);
    });
  });
});
