export interface ItemPedido {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
}

export interface ItemPedidoInput {
  produtoId: string;
  quantidade: number;
}

export type PedidoStatus =
  "pendente" | "confirmado" | "enviado" | "entregue" | "aguardando_devolucao" | "cancelado";

export type PaymentStatus =
  "aguardando_pagamento" | "pago" | "falhou" | "estorno_pendente" | "reembolsado";

export interface Pedido {
  id: string;
  clienteId: string;
  itens: ItemPedido[];
  total: number;
  status: PedidoStatus;
  paymentIntentId: string | null;
  paymentClientSecret: string | null;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CriarPedidoInput {
  itens: ItemPedidoInput[];
}

export interface AlterarStatusInput {
  status: PedidoStatus;
}

/**
 * Espelha a maquina de estados de RN05/RN33 (services/orders/src/services/pedidos.statusMachine.ts)
 * apenas para restringir as opcoes exibidas na UI do Admin (Task 16.2.2) - a
 * validacao real da transicao permanece no backend (RN26). Fase 5: `enviado`
 * nao vai mais direto para `cancelado` - passa por `aguardando_devolucao`
 * (RN29), que so entao pode ir para `cancelado` (RN30).
 */
export const TRANSICOES_VALIDAS: Record<PedidoStatus, PedidoStatus[]> = {
  pendente: ["confirmado", "cancelado"],
  confirmado: ["enviado", "cancelado"],
  enviado: ["entregue", "aguardando_devolucao"],
  entregue: [],
  aguardando_devolucao: ["cancelado"],
  cancelado: [],
};
