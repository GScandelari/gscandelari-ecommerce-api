import { request } from "@/api/apiClient";
import type { AlterarStatusInput, CriarPedidoInput, Pedido } from "@/types/pedido";

export const listarPedidos = (): Promise<Pedido[]> => request<Pedido[]>("/pedidos");

export const obterPedido = (id: string): Promise<Pedido> => request<Pedido>(`/pedidos/${id}`);

export const criarPedido = (data: CriarPedidoInput): Promise<Pedido> =>
  request<Pedido>("/pedidos", { method: "POST", body: data });

export const alterarStatusPedido = (id: string, data: AlterarStatusInput): Promise<Pedido> =>
  request<Pedido>(`/pedidos/${id}/status`, { method: "PATCH", body: data });

export const cancelarPedido = (id: string): Promise<Pedido> =>
  request<Pedido>(`/pedidos/${id}/cancelar`, { method: "PATCH" });
