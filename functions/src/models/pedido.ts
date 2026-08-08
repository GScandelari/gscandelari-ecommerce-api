import { PedidoStatus } from "@/services/pedidos.statusMachine";

export interface ItemPedido {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
}

/**
 * Fase 2 (RN10-RN15): estado do pagamento, independente de `status` (RN05).
 * Fase 5 (RN31/RN32): `estorno_pendente` - o pedido foi cancelado enquanto
 * `paymentStatus` era `"pago"`, um reembolso e devido mas ainda nao foi
 * processado; `reembolsado` - o Admin solicitou e o Stripe confirmou o
 * reembolso (`PATCH /pedidos/:id/reembolsar`).
 */
export type PaymentStatus =
  | "aguardando_pagamento"
  | "pago"
  | "falhou"
  | "estorno_pendente"
  | "reembolsado";

export interface Pedido {
  id: string;
  clienteId: string;
  itens: ItemPedido[];
  total: number;
  status: PedidoStatus;
  paymentIntentId: string | null;
  paymentClientSecret: string | null;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type PedidoInput = Omit<Pedido, "id">;
