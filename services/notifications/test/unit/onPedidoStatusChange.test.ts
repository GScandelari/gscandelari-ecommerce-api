// Este import DEVE vir antes de `../../src/triggers/onPedidoStatusChange`
// para que o mock virtual sobre "@/resendClient" seja registrado antes de
// qualquer `require` real do SDK do Resend.
import { mockEmailsSend, resetResendMocks } from "../helpers/mockResend";
import { createTestUser, TestUser } from "../helpers/testAuth";
// Task 10.2.1 (Modulo 10 - AINDA NAO IMPLEMENTADO): Firestore Trigger
// `onPedidoStatusChange` (`onDocumentUpdated("pedidos/{pedidoId}", ...)`).
// Import falhara ("Cannot find module") ate `src/triggers/onPedidoStatusChange.ts`
// ser criado - estado "vermelho" esperado em TDD para RN19.
import { onPedidoStatusChange } from "../../src/triggers/onPedidoStatusChange";

/**
 * Testes do trigger `onPedidoStatusChange` - RN19 (Modulo 10 - Epico 10.2,
 * Modulo 12 - Task 12.3.1 a 12.3.4).
 *
 * Invoca a CloudFunction diretamente via `.run(event)` - o seam de teste
 * oficialmente documentado pelo `firebase-functions` v2
 * (`CloudFunction.run`: "Use `run` to test a function"), sem precisar subir
 * o Functions Emulator nem depender de infraestrutura de trigger real. O
 * `event.data.before`/`event.data.after` sao dubles simples de
 * `QueryDocumentSnapshot` (so precisam do metodo `.data()`, unico usado pelo
 * handler).
 *
 * Requer Auth Emulator rodando (`npm run test:emulator`) para
 * `admin.auth().getUser` resolver um e-mail real (Decisao tecnica 5).
 */

interface PedidoDocFake {
  clienteId: string;
  status: string;
  total: number;
  paymentIntentId?: string | null;
}

/**
 * Duble minimo de `QueryDocumentSnapshot` - o handler so usa `.data()`
 * (e opcionalmente `.id`), entao nao ha necessidade de depender do tipo
 * completo do Admin SDK aqui.
 */
function makeSnapshot(data: PedidoDocFake | undefined): {
  id: string;
  data: () => PedidoDocFake | undefined;
} {
  return { id: "pedido-teste-1", data: () => data };
}

function makeEvent(
  before: PedidoDocFake | undefined,
  after: PedidoDocFake | undefined,
  pedidoId = "pedido-teste-1",
) {
  return {
    data: { before: makeSnapshot(before), after: makeSnapshot(after) },
    params: { pedidoId },
  } as any;
}

describe("Trigger onPedidoStatusChange - RN19 (Modulo 10 - Epico 10.2 / Task 12.3.1-12.3.4)", () => {
  let cliente: TestUser;

  beforeAll(async () => {
    cliente = await createTestUser({ admin: false });
  });

  beforeEach(() => {
    resetResendMocks();
  });

  // Task 12.3.1
  it("RN19: status transiciona 'pendente' -> 'confirmado' - envia e-mail ao cliente dono do pedido, resolvido via admin.auth().getUser", async () => {
    mockEmailsSend.mockResolvedValue({ id: "email-1" });
    const before: PedidoDocFake = { clienteId: cliente.uid, status: "pendente", total: 60 };
    const after: PedidoDocFake = { clienteId: cliente.uid, status: "confirmado", total: 60 };

    await onPedidoStatusChange.run(makeEvent(before, after));

    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    const chamada = mockEmailsSend.mock.calls[0][0];
    expect(chamada.to).toBe(cliente.email);
    expect(String(chamada.subject).toLowerCase()).toContain("confirmado");
  });

  // Task 12.3.2
  it("RN19: status transiciona 'pendente' -> 'cancelado' - envia e-mail ao cliente dono do pedido", async () => {
    mockEmailsSend.mockResolvedValue({ id: "email-2" });
    const before: PedidoDocFake = { clienteId: cliente.uid, status: "pendente", total: 30 };
    const after: PedidoDocFake = { clienteId: cliente.uid, status: "cancelado", total: 30 };

    await onPedidoStatusChange.run(makeEvent(before, after));

    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    const chamada = mockEmailsSend.mock.calls[0][0];
    expect(chamada.to).toBe(cliente.email);
    expect(String(chamada.subject).toLowerCase()).toContain("cancelado");
  });

  // Task 12.3.3 / Decisao tecnica 5
  it("RN19 (Decisao tecnica 5): update que NAO altera status (ex.: so grava paymentIntentId) nao dispara e-mail", async () => {
    const before: PedidoDocFake = {
      clienteId: cliente.uid,
      status: "pendente",
      total: 60,
      paymentIntentId: null,
    };
    const after: PedidoDocFake = {
      clienteId: cliente.uid,
      status: "pendente",
      total: 60,
      paymentIntentId: "pi_123",
    };

    await onPedidoStatusChange.run(makeEvent(before, after));

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it("RN19 (Decisao tecnica 5): transicao para status fora de confirmado/cancelado (ex.: 'enviado') nao dispara e-mail", async () => {
    const before: PedidoDocFake = { clienteId: cliente.uid, status: "confirmado", total: 60 };
    const after: PedidoDocFake = { clienteId: cliente.uid, status: "enviado", total: 60 };

    await onPedidoStatusChange.run(makeEvent(before, after));

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it("RN19 (Decisao tecnica 5): transicao para 'entregue' nao dispara e-mail", async () => {
    const before: PedidoDocFake = { clienteId: cliente.uid, status: "enviado", total: 60 };
    const after: PedidoDocFake = { clienteId: cliente.uid, status: "entregue", total: 60 };

    await onPedidoStatusChange.run(makeEvent(before, after));

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  // Task 12.3.4
  it("RN19 (clausula best-effort): falha do SDK do Resend nao propaga excecao nem bloqueia a conclusao da function", async () => {
    mockEmailsSend.mockRejectedValue(new Error("resend indisponivel (simulado)"));
    const before: PedidoDocFake = { clienteId: cliente.uid, status: "pendente", total: 60 };
    const after: PedidoDocFake = { clienteId: cliente.uid, status: "confirmado", total: 60 };

    // Se a function propagasse a excecao do Resend, este await rejeitaria e
    // o teste falharia automaticamente - a ausencia de erro aqui e a
    // asserção da clausula best-effort de RN19 (a transicao de status ja foi
    // efetivada por Orders antes do trigger disparar, e nunca e revertida).
    await onPedidoStatusChange.run(makeEvent(before, after));

    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
  });

  it("RN19 (clausula best-effort): clienteId sem usuario correspondente no Auth Emulator -> best-effort, sem excecao nao tratada", async () => {
    const before: PedidoDocFake = {
      clienteId: "uid-inexistente-no-auth-emulator",
      status: "pendente",
      total: 60,
    };
    const after: PedidoDocFake = {
      clienteId: "uid-inexistente-no-auth-emulator",
      status: "confirmado",
      total: 60,
    };

    await onPedidoStatusChange.run(makeEvent(before, after));

    // Sem e-mail resolvido, o envio nem deve ser tentado - mas o principal e
    // que o `await` acima nao lancou excecao nao tratada.
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });
});
