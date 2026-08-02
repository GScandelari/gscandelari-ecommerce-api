import { PedidoStatus } from "@/services/pedidos.statusMachine";

export interface ItemPedido {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
}

export interface Pedido {
  id: string;
  clienteId: string;
  itens: ItemPedido[];
  total: number;
  status: PedidoStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type PedidoInput = Omit<Pedido, "id">;
