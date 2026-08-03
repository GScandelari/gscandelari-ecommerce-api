// Task 2.6.1 (Modulo 2 - AINDA NAO IMPLEMENTADO): funcao pura de maquina de
// estados de status de Pedido. Este import falhara ("Cannot find module")
// ate que src/services/pedidos.statusMachine.ts seja criado - esse e o
// estado "vermelho" esperado em TDD para RN05.
import { isValidTransition, PedidoStatus } from "../../src/services/pedidos.statusMachine";

describe("Maquina de estados de status do Pedido - RN05 (Task 2.6.1 / 3.3.4)", () => {
  const validTransitions: [PedidoStatus, PedidoStatus][] = [
    ["pendente", "confirmado"],
    ["confirmado", "enviado"],
    ["enviado", "entregue"],
    ["pendente", "cancelado"],
    // RN05 (SPEC.md) foi emendada apos o relatorio do qa-negocio: a
    // maquina de estados estrutural e agnostica de papel, entao cancelado
    // e alcancavel tambem a partir de confirmado/enviado. Quem pode
    // efetivamente disparar cada transicao (cliente so a partir de
    // pendente, admin a partir de qualquer uma destas tres) e decidido na
    // camada de rota/servico (RN06/RN07/RN07a), nao aqui.
    ["confirmado", "cancelado"],
    ["enviado", "cancelado"],
  ];

  it.each(validTransitions)("RN05: %s -> %s deve ser valida", (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  const invalidTransitions: [PedidoStatus, PedidoStatus][] = [
    ["enviado", "confirmado"],
    ["entregue", "pendente"],
    ["cancelado", "pendente"],
    ["confirmado", "pendente"],
    // RN07 exclui explicitamente "entregue" das transicoes de cancelamento
    // permitidas ao admin ("cancelar em qualquer estado ANTERIOR a
    // entregue"), entao esta e invalida para qualquer papel.
    ["entregue", "cancelado"],
  ];

  it.each(invalidTransitions)("RN05: %s -> %s deve ser invalida", (from, to) => {
    expect(isValidTransition(from, to)).toBe(false);
  });
});
