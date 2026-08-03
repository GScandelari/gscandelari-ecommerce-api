// Este import DEVE vir antes de `../../src/app" para que o jest.mock virtual
// sobre "@/stripeClient" (helpers/mockStripe.ts) seja registrado antes de
// qualquer modulo do Modulo 5 (stripeService.ts, pedidosService.ts, etc.)
// tentar carregar o cliente Stripe real.
import { mockPaymentIntentsCreate, resetStripeMocks } from "../helpers/mockStripe";
import request from "supertest";
import app from "../../src/app";
import { createTestUser, TestUser } from "../helpers/testAuth";
import { clearFirestoreEmulator } from "../helpers/firestoreTestUtils";
import { getAdminApp } from "../helpers/adminApp";

/**
 * Testes de integracao de criacao de Pedido com pagamento Stripe - RN10
 * (Modulo 7 - Epico 7.2 - Tasks 7.2.1/7.2.2).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): o Modulo 5 (stripeClient.ts,
 * stripeService.ts, `criarPedidoComPagamento`, e a extensao de
 * `POST /pedidos` na Task 5.3.4) AINDA NAO EXISTE. `POST /pedidos` hoje
 * (Fase 1, inalterada) nao cria PaymentIntent nem inclui
 * `paymentIntentId`/`paymentClientSecret` na resposta, entao as asserções
 * de payload/Firestore abaixo falharao - esse e o comportamento correto e
 * esperado nesta fase.
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

describe("Criacao de Pedido com pagamento Stripe - RN10 (Modulo 7 - Epico 7.2)", () => {
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

  // Task 7.2.1
  it("RN10: sucesso - paymentIntents.create mockada retorna id+client_secret -> 201 inclui paymentIntentId/paymentClientSecret, persistidos no Firestore", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({
      id: "pi_test_123",
      client_secret: "pi_test_123_secret_abc",
    });

    const produtoId = await criarProduto(adminUser, { preco: 20, estoque: 10 });

    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${clienteA.idToken}`)
      .send({ itens: [{ produtoId, quantidade: 3 }] });

    expect(res.status).toBe(201);
    expect(res.body.paymentIntentId).toBe("pi_test_123");
    expect(res.body.paymentClientSecret).toBe("pi_test_123_secret_abc");
    expect(res.body.total).toBeCloseTo(60);

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 6000, // 60 reais em centavos
        currency: "brl",
        metadata: expect.objectContaining({ pedidoId: res.body.id }),
      }),
    );

    const snap = await getAdminApp().firestore().collection("pedidos").doc(res.body.id).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.paymentIntentId).toBe("pi_test_123");
    expect(snap.data()?.paymentClientSecret).toBe("pi_test_123_secret_abc");
    expect(await lerEstoqueDireto(produtoId)).toBe(7);
  });

  // Task 7.2.2
  it("RN10: falha do Stripe (paymentIntents.create rejeitada) -> 502; pedido fica cancelado/paymentStatus falhou; estoque restaurado", async () => {
    mockPaymentIntentsCreate.mockRejectedValue(new Error("stripe indisponivel (simulado)"));

    const produtoId = await criarProduto(adminUser, { preco: 15, estoque: 10 });

    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${clienteA.idToken}`)
      .send({ itens: [{ produtoId, quantidade: 4 }] });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      error: { code: expect.any(String), message: expect.any(String) },
    });

    // Estoque restaurado ao valor original - nenhuma baixa "orfa" sem PaymentIntent associada.
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
    // Nenhuma PaymentIntent "fantasma" referenciada no documento.
    expect(pedidoData.paymentIntentId).toBeNull();
  });
});
