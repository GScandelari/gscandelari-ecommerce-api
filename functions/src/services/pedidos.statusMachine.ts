export type PedidoStatus = "pendente" | "confirmado" | "enviado" | "entregue" | "cancelado";

/**
 * Transicoes estruturalmente validas (RN05), independentes de quem as
 * dispara. Cancelamento e alcancavel a partir de pendente, confirmado ou
 * enviado (nunca a partir de entregue) - a restricao de qual papel pode
 * disparar cada transicao (cliente vs admin) e responsabilidade da camada
 * de rota/servico (RN06/RN07/RN07a), nao desta funcao.
 */
const VALID_TRANSITIONS: Record<PedidoStatus, PedidoStatus[]> = {
  pendente: ["confirmado", "cancelado"],
  confirmado: ["enviado", "cancelado"],
  enviado: ["entregue", "cancelado"],
  entregue: [],
  cancelado: [],
};

export function isValidTransition(from: PedidoStatus, to: PedidoStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
