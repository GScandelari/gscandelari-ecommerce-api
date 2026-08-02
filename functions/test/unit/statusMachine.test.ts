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

  // GAP DE ESPECIFICACAO (sinalizado no relatorio do agente qa-negocio):
  // o criterio de aceite da Task 2.6.1, lido literalmente, lista como
  // unica transicao de cancelamento valida "pendente -> cancelado". Porem
  // RN07/RN07a exigem que um Admin consiga cancelar pedidos em
  // "confirmado" ou "enviado" (a diferenca e apenas se o estoque e
  // restaurado ou nao). Ou seja, `isValidTransition("confirmado",
  // "cancelado")` e `isValidTransition("enviado", "cancelado")` deveriam
  // provavelmente retornar `true` quando avaliados no contexto de um
  // Admin, mas a assinatura da funcao pura descrita na Task 2.6.1 nao
  // recebe o papel do usuario como parametro. Por isso, NENHUMA asserção
  // sobre esses dois casos foi incluída aqui (nem como válida nem como
  // inválida) - decisão deliberadamente deixada em aberto para quem
  // implementar o Módulo 2, que precisará decidir entre (a) adicionar um
  // parâmetro de papel/contexto a `isValidTransition`, ou (b) tratar o
  // cancelamento por Admin fora de `pendente` como uma regra à parte na
  // camada de rota (Task 2.6.5), sem passar por esta função pura.
  // O comportamento observável do endpoint (RN07a) É coberto e travado
  // pelos testes de integração em test/integration/pedidos.test.ts.
});
