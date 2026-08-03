export interface ItemPedido {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
}

export interface ItemPedidoInput {
  produtoId: string;
  quantidade: number;
}

export type PedidoStatus = "pendente" | "confirmado" | "enviado" | "entregue" | "cancelado";

export type PaymentStatus = "aguardando_pagamento" | "pago" | "falhou";

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
 * Espelha a maquina de estados de RN05 (functions/src/services/pedidos.statusMachine.ts)
 * apenas para restringir as opcoes exibidas na UI do Admin (Task 16.2.2) - a
 * validacao real da transicao permanece no backend (RN26).
 */
export const TRANSICOES_VALIDAS: Record<PedidoStatus, PedidoStatus[]> = {
  pendente: ["confirmado", "cancelado"],
  confirmado: ["enviado", "cancelado"],
  enviado: ["entregue", "cancelado"],
  entregue: [],
  cancelado: [],
};
