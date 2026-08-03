// Estes imports DEVEM vir antes de `../../src/app` para que os mocks
// virtuais sejam registrados antes de qualquer `require` real.
import { mockWebhooksConstructEvent, resetStripeMocks } from "../helpers/mockStripe";
import {
  mockConfirmarPagamentoPedido,
  mockCancelarPedidoPorFalhaPagamento,
  resetOrdersInternalClientMocks,
} from "../helpers/mockOrdersInternalClient";
import request from "supertest";
import app from "../../src/app";
import { clearFirestoreEmulator } from "../helpers/firestoreTestUtils";
import { getAdminApp } from "../helpers/adminApp";

/**
 * Testes de integracao do webhook `POST /webhooks/stripe` chamando os
 * endpoints internos de Orders - RN17 (Modulo 9 - Epico 9.3 - Tasks
 * 9.3.2/9.3.3/9.3.4, Modulo 12 - Tasks 12.2.5/12.2.6).
 *
 * ESTADO ESPERADO ATUAL (TDD "vermelho"): `services/payments/src/app.ts`,
 * `routes/webhooks.routes.ts` (adaptado) e `services/orders.internalClient.ts`
 * (Task 9.3.2) AINDA NAO EXISTEM.
 *
 * Requer Firestore Emulator rodando (`npm run test:emulator`) - usado
 * apenas para a colecao `stripeEvents` (idempotencia, RN14); Payments nunca
 * escreve em `pedidos` (Task 9.3.3).
 */

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

describe("Webhook Stripe -> chamada HTTP interna a Orders - RN17 (Modulo 9 - Epico 9.3 / Modulo 12 - Task 12.2.5/12.2.6)", () => {
  beforeEach(async () => {
    resetStripeMocks();
    resetOrdersInternalClientMocks();
    await clearFirestoreEmulator();
  });

  afterEach(async () => {
    await clearFirestoreEmulator();
  });

  // Task 12.2.5
  it("RN17: payment_intent.succeeded -> chama confirmarPagamentoPedido no cliente interno de Orders com o pedidoId correto, responde 200", async () => {
    const event = eventoSucceeded("evt_int_succeeded", "pedido-abc", "pi_abc");
    mockWebhooksConstructEvent.mockReturnValue(event);
    mockConfirmarPagamentoPedido.mockResolvedValue(undefined);

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    expect(mockConfirmarPagamentoPedido).toHaveBeenCalledWith("pedido-abc");
    expect(mockCancelarPedidoPorFalhaPagamento).not.toHaveBeenCalled();
  });

  // Task 12.2.5
  it("RN17: payment_intent.payment_failed -> chama cancelarPedidoPorFalhaPagamento no cliente interno de Orders com o pedidoId correto, responde 200", async () => {
    const event = eventoFailed("evt_int_failed", "pedido-def", "pi_def");
    mockWebhooksConstructEvent.mockReturnValue(event);
    mockCancelarPedidoPorFalhaPagamento.mockResolvedValue(undefined);

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    expect(mockCancelarPedidoPorFalhaPagamento).toHaveBeenCalledWith("pedido-def");
    expect(mockConfirmarPagamentoPedido).not.toHaveBeenCalled();
  });

  // Task 12.2.6 / Decisao tecnica 6
  it("RN17 (Decisao tecnica 6): falha na chamada interna a Orders -> webhook responde 5xx ao Stripe, sem registrar em stripeEvents (permite reentrega)", async () => {
    const event = eventoSucceeded("evt_int_falha_chamada", "pedido-ghi", "pi_ghi");
    mockWebhooksConstructEvent.mockReturnValue(event);
    mockConfirmarPagamentoPedido.mockRejectedValue(new Error("Orders indisponivel (simulado)"));

    const res = await postWebhook(event);

    expect(res.status).toBeGreaterThanOrEqual(500);
    const stripeEventsSnap = await getAdminApp()
      .firestore()
      .collection("stripeEvents")
      .where("eventId", "==", "evt_int_falha_chamada")
      .get();
    expect(stripeEventsSnap.size).toBe(0);
  });

  // Task 9.3.3
  it("Task 9.3.3: Payments nunca escreve diretamente na colecao pedidos do Firestore, mesmo processando um evento com sucesso", async () => {
    const event = eventoSucceeded("evt_sem_escrita_direta", "pedido-jkl", "pi_jkl");
    mockWebhooksConstructEvent.mockReturnValue(event);
    mockConfirmarPagamentoPedido.mockResolvedValue(undefined);

    await postWebhook(event);

    const pedidosSnap = await getAdminApp().firestore().collection("pedidos").get();
    expect(pedidosSnap.size).toBe(0);
  });

  // RN14, agora um concern 100% interno de Payments (Decisao tecnica 3), checado ANTES da chamada HTTP a Orders
  it("RN14: reenvio do mesmo event.id nao chama o cliente interno de Orders uma segunda vez", async () => {
    const event = eventoSucceeded("evt_int_dup", "pedido-mno", "pi_mno");
    mockWebhooksConstructEvent.mockReturnValue(event);
    mockConfirmarPagamentoPedido.mockResolvedValue(undefined);

    const res1 = await postWebhook(event);
    expect(res1.status).toBe(200);
    expect(mockConfirmarPagamentoPedido).toHaveBeenCalledTimes(1);

    const res2 = await postWebhook(event);
    expect(res2.status).toBe(200);
    // Idempotencia (RN14): nao chama Orders de novo na reentrega.
    expect(mockConfirmarPagamentoPedido).toHaveBeenCalledTimes(1);
  });
});
