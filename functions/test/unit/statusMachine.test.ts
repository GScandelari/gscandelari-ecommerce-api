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
    ["confirmado", "cancelado"],
    // RN05 (SPEC.md) foi emendada apos o relatorio do qa-negocio: a
    // maquina de estados estrutural e agnostica de papel, entao cancelado
    // e alcancavel tambem a partir de confirmado. Quem pode efetivamente
    // disparar cada transicao (cliente so a partir de pendente/confirmado,
    // admin a partir de qualquer uma destas) e decidido na camada de
    // rota/servico (RN06/RN07/RN07a/RN28), nao aqui.
    //
    // NOTA (Fase 5, Modulo 22 - Epico 22.2 - Task 18.2.2): `enviado ->
    // cancelado` SAIU deste bloco de transicoes validas - ver bloco
    // "Fase 5 (RN29/RN33)" abaixo, que documenta essa mudanca de contrato
    // explicitamente (nao e uma regressao).
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

  /**
   * Fase 5 (Modulo 22 - Epico 22.2 - Tasks 22.2.1/18.2.2), cobre RN33.
   *
   * RN33 estende PedidoStatus com "aguardando_devolucao" e reescreve a
   * tabela de transicoes a partir de "enviado": `enviado -> [entregue,
   * aguardando_devolucao]` (troca `cancelado` por `aguardando_devolucao`
   * como destino de cancelamento a partir daqui), e adiciona
   * `aguardando_devolucao -> [cancelado]` (somente Admin dispara,
   * RN30 - a restricao de papel e decidida na camada de servico, nao aqui).
   *
   * Tabela de transicoes a partir de "enviado", ANTES x DEPOIS da Fase 5:
   *   - ANTES (Fase 1, RN05): enviado -> [entregue, cancelado]
   *   - DEPOIS (Fase 5, RN33): enviado -> [entregue, aguardando_devolucao]
   *
   * A UNICA transicao estruturalmente valida na Fase 1 que deixa de ser
   * valida na Fase 5 e `enviado -> cancelado` (ver teste dedicado abaixo,
   * nomeado explicitamente para nao ser confundido com uma regressao).
   * Todas as demais transicoes herdadas da Fase 1 (pendente->confirmado,
   * pendente->cancelado, confirmado->enviado, confirmado->cancelado,
   * enviado->entregue) permanecem exatamente como estavam - cobertas pelos
   * blocos `validTransitions`/`invalidTransitions` acima, inalterados.
   */
  describe("Fase 5 (RN29/RN33): novo status aguardando_devolucao", () => {
    const novasTransicoesValidas: [PedidoStatus, PedidoStatus][] = [
      ["enviado", "aguardando_devolucao"],
      ["aguardando_devolucao", "cancelado"],
    ];

    it.each(novasTransicoesValidas)(
      "RN33: %s -> %s deve ser valida (novo destino introduzido pela Fase 5)",
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(true);
      },
    );

    it(
      "RN33/RN29: enviado -> cancelado deixa de ser uma transicao estruturalmente valida " +
        "(MUDANCA DE CONTRATO INTENCIONAL introduzida pela Fase 5, nao uma regressao - " +
        "cancelamento a partir de enviado agora passa obrigatoriamente por " +
        "aguardando_devolucao, ver teste acima)",
      () => {
        expect(isValidTransition("enviado", "cancelado")).toBe(false);
      },
    );

    const novasTransicoesInvalidas: [PedidoStatus, PedidoStatus][] = [
      ["aguardando_devolucao", "entregue"],
      ["aguardando_devolucao", "confirmado"],
      ["aguardando_devolucao", "pendente"],
      ["aguardando_devolucao", "enviado"],
      ["entregue", "aguardando_devolucao"],
      ["pendente", "aguardando_devolucao"],
      ["confirmado", "aguardando_devolucao"],
    ];

    it.each(novasTransicoesInvalidas)(
      "RN33: %s -> %s deve ser invalida (aguardando_devolucao so aceita 'cancelado' como destino, e so e alcancavel a partir de 'enviado')",
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(false);
      },
    );
  });
});
