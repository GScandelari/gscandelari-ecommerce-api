// Este import DEVE vir antes de `../../src/app` para que o mock virtual
// sobre "@/services/payments.internalClient" seja registrado antes de
// qualquer modulo do Modulo 9 (pedidosService.ts, etc.) tentar carregar o
// cliente HTTP interno real.
import {
  mockCriarPaymentIntent,
  resetPaymentsInternalClientMocks,
} from "../helpers/mockPaymentsInternalClient";
import request from "supertest";
import app from "../../src/app";
import { createTestUser, TestUser } from "../helpers/testAuth";
import { clearFirestoreEmulator } from "../helpers/firestoreTestUtils";
import { getAdminApp } from "../helpers/adminApp";

/**
 * Testes de integracao de criacao de Pedido chamando Payments via HTTP
 * interno - RN16 (Modulo 9 - Epico 9.2, Modulo 12 - Epico 12.2 - Tasks
 * 12.2.1/12.2.2).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): `services/orders/src/app.ts`
 * (Modulo 8) e o cliente interno `payments.internalClient.ts` (Task 9.2.2)
 * AINDA NAO EXISTEM. Este teste falhara ao importar `../../src/app` - esse e
 * o comportamento correto e esperado nesta fase.
 *
 * O contrato externo de `POST /pedidos` (para o cliente final) NAO MUDA em
 * relacao a Fase 2 (RN10 continua valendo) - o que muda e que, por baixo,
 * `criarPedidoComPagamento` chama Payments via HTTP interno autenticado em
 * vez de importar `stripeService` diretamente (Task 8.2.2/9.2.3).
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

describe("Criacao de Pedido via chamada HTTP interna a Payments - RN16 (Modulo 12 - Epico 12.2)", () => {
  let adminUser: TestUser;
  let clienteA: TestUser;

  beforeAll(async () => {
    await clearFirestoreEmulator();
    adminUser = await createTestUser({ admin: true });
    clienteA = await createTestUser({ admin: false });
  });

  beforeEach(() => {
    resetPaymentsInternalClientMocks();
  });

  afterEach(async () => {
    await clearFirestoreEmulator();
  });

  // Task 12.2.1
  it("RN16: cliente interno de Payments mockado com sucesso -> 201 com paymentIntentId/paymentClientSecret (contrato de RN10 preservado)", async () => {
    mockCriarPaymentIntent.mockResolvedValue({
      paymentIntentId: "pi_test_int_123",
      clientSecret: "pi_test_int_123_secret",
    });

    const produtoId = await criarProduto(adminUser, { preco: 20, estoque: 10 });

    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${clienteA.idToken}`)
      .send({ itens: [{ produtoId, quantidade: 3 }] });

    expect(res.status).toBe(201);
    expect(res.body.paymentIntentId).toBe("pi_test_int_123");
    expect(res.body.paymentClientSecret).toBe("pi_test_int_123_secret");
    expect(res.body.total).toBeCloseTo(60);

    // Decisao tecnica 3 do BACKLOG (Fase 3): contrato reduzido a
    // (pedidoId, total) - Payments nao recebe mais o objeto `Pedido` inteiro.
    expect(mockCriarPaymentIntent).toHaveBeenCalledWith(res.body.id, 60);

    const snap = await getAdminApp().firestore().collection("pedidos").doc(res.body.id).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.paymentIntentId).toBe("pi_test_int_123");
    expect(await lerEstoqueDireto(produtoId)).toBe(7);
  });

  // Task 12.2.2
  it("RN16/RN18: cliente interno de Payments mockado falhando (rede/401/5xx) -> 502 para o cliente final, pedido compensado", async () => {
    mockCriarPaymentIntent.mockRejectedValue(
      new Error("PaymentGatewayError: chamada interna a Payments falhou (simulado)"),
    );

    const produtoId = await criarProduto(adminUser, { preco: 15, estoque: 10 });

    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${clienteA.idToken}`)
      .send({ itens: [{ produtoId, quantidade: 4 }] });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      error: { code: expect.any(String), message: expect.any(String) },
    });

    // Mesma compensacao ja validada na Fase 2 (RN10): estoque restaurado,
    // pedido persistido como trilha de auditoria em `cancelado`.
    expect(await lerEstoqueDireto(produtoId)).toBe(10);

    const pedidosSnap = await getAdminApp()
      .firestore()
      .collection("pedidos")
      .where("clienteId", "==", clienteA.uid)
      .get();
    expect(pedidosSnap.size).toBe(1);
    const pedidoData = pedidosSnap.docs[0].data();
    expect(pedidoData.status).toBe("cancelado");
    expect(pedidoData.paymentStatus).toBe("falhou");
    expect(pedidoData.paymentIntentId).toBeNull();
  });
});
