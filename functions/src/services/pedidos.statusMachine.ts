export type PedidoStatus =
  | "pendente"
  | "confirmado"
  | "enviado"
  | "entregue"
  | "aguardando_devolucao"
  | "cancelado";

/**
 * Transicoes estruturalmente validas (RN05), independentes de quem as
 * dispara. Cancelamento e alcancavel a partir de pendente ou confirmado
 * (nunca a partir de entregue) - a restricao de qual papel pode disparar
 * cada transicao (cliente vs admin) e responsabilidade da camada de
 * rota/servico (RN06/RN07/RN07a/RN28), nao desta funcao.
 *
 * Fase 5 (RN29/RN33): `enviado` NAO vai mais direto para `cancelado` - o
 * produto ainda esta fisicamente com o cliente. Em vez disso, `enviado`
 * transiciona para o novo estado intermediario `aguardando_devolucao`
 * (Cliente ou Admin, RN29), que so entao pode ir para `cancelado`
 * (somente Admin, confirmando que o produto retornou - RN30).
 */
const VALID_TRANSITIONS: Record<PedidoStatus, PedidoStatus[]> = {
  pendente: ["confirmado", "cancelado"],
  confirmado: ["enviado", "cancelado"],
  enviado: ["entregue", "aguardando_devolucao"],
  entregue: [],
  aguardando_devolucao: ["cancelado"],
  cancelado: [],
};

export function isValidTransition(from: PedidoStatus, to: PedidoStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
