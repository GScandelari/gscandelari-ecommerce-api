export interface Produto {
  id: string;
  nome: string;
  preco: number;
  /** Inteiro >= 0 (RN01). */
  estoque: number;
}

export type ProdutoInput = Omit<Produto, "id">;
