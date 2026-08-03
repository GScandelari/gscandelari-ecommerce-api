import { request } from "@/api/apiClient";
import type { Produto, ProdutoInput } from "@/types/produto";

export const listarProdutos = (): Promise<Produto[]> => request<Produto[]>("/produtos");

export const obterProduto = (id: string): Promise<Produto> => request<Produto>(`/produtos/${id}`);

export const criarProduto = (data: ProdutoInput): Promise<Produto> =>
  request<Produto>("/produtos", { method: "POST", body: data });

export const atualizarProduto = (id: string, data: ProdutoInput): Promise<Produto> =>
  request<Produto>(`/produtos/${id}`, { method: "PUT", body: data });

export const removerProduto = (id: string): Promise<void> =>
  request<void>(`/produtos/${id}`, { method: "DELETE" });
