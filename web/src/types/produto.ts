export interface Produto {
  id: string;
  nome: string;
  preco: number;
  estoque: number;
}

export type ProdutoInput = Omit<Produto, "id">;
