// Estes imports DEVEM vir antes de `../../src/app` para que os mocks virtuais
// sejam registrados antes de qualquer modulo do Modulo 9 tentar carregar o
// cliente HTTP interno real. Usa mockVerifyInternalToken (mock da fronteira
// @/middlewares/verifyInternalToken), NAO mockGoogleAuthLibrary - este
// arquivo tambem exercita Firestore real via pedidosService, e mockar o
// pacote `google-auth-library` inteiro quebraria a autenticacao interna do
// proprio Admin SDK do Firestore (ver comentario em mockVerifyInternalToken.ts).
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
 * Testes de integracao dos endpoints internos de Orders, chamados por
 * Payments quando o webhook do Stripe processa um evento de pagamento -
 * RN17, RN18 (Modulo 9 - Epico 9.3 - Task 9.3.1, Modulo 12 - Task 12.2.4).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): `POST /internal/pedidos/:id/confirmar-pagamento`
 * e `POST /internal/pedidos/:id/cancelar-por-falha-pagamento` (Task 9.3.1)
 * AINDA NAO EXISTEM em `services/orders/src/app.ts`/rotas - toda chamada
 * abaixo recebera 404 do Express ate o Modulo 9 ser implementado.
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

/** Cria um pedido `pendente` via fluxo publico (RN16), com o cliente interno de Payments mockado. */
async function criarPedidoPendente(
  clienteUser: TestUser,
  produtoId: string,
  quantidade: number,
): Promise<string> {
  mockCriarPaymentIntent.mockResolvedValueOnce({
    paymentIntentId: `pi_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    clientSecret: "secret_simulado",
  });

  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${clienteUser.idToken}`)
    .send({ itens: [{ produtoId, quantidade }] });

  return res.body.id as string;
}

async function lerPedidoDireto(pedidoId: string) {
  const snap = await getAdminApp().firestore().collection("pedidos").doc(pedidoId).get();
  return snap.exists ? snap.data() : undefined;
}

async function lerEstoqueDireto(produtoId: string): Promise<number | undefined> {
  const snap = await getAdminApp().firestore().collection("produtos").doc(produtoId).get();
  return snap.exists ? (snap.data()?.estoque as number) : undefined;
}

function tokenValidoDePayments() {
  setInternalTokenValido(true);
}

describe("Endpoints internos de Orders (chamados por Payments) - RN17, RN18 (Modulo 12 - Epico 12.2)", () => {
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

  // Task 12.2.4
  it("RN18: POST /internal/pedidos/:id/confirmar-pagamento sem Authorization -> 401", async () => {
    const res = await request(app)
      .post("/internal/pedidos/qualquer-id/confirmar-pagamento")
      .send({});
    expect(res.status).toBe(401);
  });

  // Task 12.2.4
  it("RN18: POST /internal/pedidos/:id/cancelar-por-falha-pagamento sem Authorization -> 401", async () => {
    const res = await request(app)
      .post("/internal/pedidos/qualquer-id/cancelar-por-falha-pagamento")
      .send({});
    expect(res.status).toBe(401);
  });

  // Task 9.3.1 / RN17
  it("RN17: token interno valido + pedido pendente -> confirmar-pagamento efetiva a transicao (200, status vira 'confirmado')", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedidoId = await criarPedidoPendente(clienteA, produtoId, 2);
    tokenValidoDePayments();

    const res = await request(app)
      .post(`/internal/pedidos/${pedidoId}/confirmar-pagamento`)
      .set("Authorization", "Bearer token-interno-valido-de-payments")
      .send({});

    expect(res.status).toBe(200);
    const pedido = await lerPedidoDireto(pedidoId);
    expect(pedido?.status).toBe("confirmado");
    expect(pedido?.paymentStatus).toBe("pago");
  });

  // Task 9.3.1 / RN17
  it("RN17: token interno valido + pedido pendente -> cancelar-por-falha-pagamento efetiva a transicao (200, status vira 'cancelado', estoque restaurado)", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedidoId = await criarPedidoPendente(clienteA, produtoId, 4);
    expect(await lerEstoqueDireto(produtoId)).toBe(6);
    tokenValidoDePayments();

    const res = await request(app)
      .post(`/internal/pedidos/${pedidoId}/cancelar-por-falha-pagamento`)
      .set("Authorization", "Bearer token-interno-valido-de-payments")
      .send({});

    expect(res.status).toBe(200);
    expect(await lerEstoqueDireto(produtoId)).toBe(10);
    const pedido = await lerPedidoDireto(pedidoId);
    expect(pedido?.status).toBe("cancelado");
    expect(pedido?.paymentStatus).toBe("falhou");
  });

  // RN15 preservada atraves da fronteira HTTP interna (Task 9.3.1 criterio de aceite)
  it("RN17/RN15: pedido inexistente -> 200 noop (nenhum erro, nenhuma escrita)", async () => {
    tokenValidoDePayments();

    const res = await request(app)
      .post("/internal/pedidos/pedido-que-nao-existe/confirmar-pagamento")
      .set("Authorization", "Bearer token-interno-valido-de-payments")
      .send({});

    expect(res.status).toBe(200);
    const snap = await getAdminApp()
      .firestore()
      .collection("pedidos")
      .doc("pedido-que-nao-existe")
      .get();
    expect(snap.exists).toBe(false);
  });

  // RN15 preservada atraves da fronteira HTTP interna
  it("RN17/RN15: pedido ja fora de 'pendente' -> 200 noop, sem alteracao adicional", async () => {
    const produtoId = await criarProduto(adminUser, { estoque: 10 });
    const pedidoId = await criarPedidoPendente(clienteA, produtoId, 1);
    tokenValidoDePayments();

    // Primeira chamada confirma o pagamento (pendente -> confirmado).
    await request(app)
      .post(`/internal/pedidos/${pedidoId}/confirmar-pagamento`)
      .set("Authorization", "Bearer token-interno-valido-de-payments")
      .send({});

    const antes = await lerPedidoDireto(pedidoId);

    // Reentrega atrasada do webhook (RN14, ja resolvida em Payments antes de
    // chamar Orders) chega chamando cancelar-por-falha-pagamento fora de 'pendente'.
    const res = await request(app)
      .post(`/internal/pedidos/${pedidoId}/cancelar-por-falha-pagamento`)
      .set("Authorization", "Bearer token-interno-valido-de-payments")
      .send({});

    expect(res.status).toBe(200);
    const depois = await lerPedidoDireto(pedidoId);
    expect(depois?.status).toBe("confirmado");
    expect(depois?.status).toBe(antes?.status);
  });
});
