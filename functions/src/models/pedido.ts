import { PedidoStatus } from "@/services/pedidos.statusMachine";

export interface ItemPedido {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
}

/** Fase 2 (RN10-RN15): estado do pagamento, independente de `status` (RN05). */
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
  createdAt: Date;
  updatedAt: Date;
}

export type PedidoInput = Omit<Pedido, "id">;
