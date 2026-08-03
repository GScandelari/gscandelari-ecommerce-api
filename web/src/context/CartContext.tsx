import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Produto } from "@/types/produto";

export interface CartItem {
  produto: Produto;
  quantidade: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (produto: Produto, quantidade: number) => void;
  removeItem: (produtoId: string) => void;
  updateQuantidade: (produtoId: string, quantidade: number) => void;
  clear: () => void;
  total: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

// Decisao tecnica 5: carrinho existe apenas em memoria (useState), nunca
// persistido (localStorage/backend) - reiniciar a pagina limpa o carrinho.
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(produto: Produto, quantidade: number): void {
    setItems((prev) => {
      const existing = prev.find((item) => item.produto.id === produto.id);
      const quantidadeAtual = existing?.quantidade ?? 0;
      const novaQuantidade = Math.min(quantidadeAtual + quantidade, produto.estoque);
      if (existing) {
        return prev.map((item) =>
          item.produto.id === produto.id ? { ...item, quantidade: novaQuantidade } : item,
        );
      }
      return [...prev, { produto, quantidade: novaQuantidade }];
    });
  }

  function removeItem(produtoId: string): void {
    setItems((prev) => prev.filter((item) => item.produto.id !== produtoId));
  }

  function updateQuantidade(produtoId: string, quantidade: number): void {
    setItems((prev) =>
      prev.map((item) =>
        item.produto.id === produtoId
          ? { ...item, quantidade: Math.max(1, Math.min(quantidade, item.produto.estoque)) }
          : item,
      ),
    );
  }

  function clear(): void {
    setItems([]);
  }

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.produto.preco * item.quantidade, 0),
    [items],
  );

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantidade, clear, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de <CartProvider>.");
  return ctx;
}
