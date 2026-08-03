import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarProdutos } from "@/api/produtos";
import { ApiError } from "@/api/apiClient";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useCart } from "@/context/CartContext";
import type { Produto } from "@/types/produto";

/** RN22: catalogo de produtos visivel para qualquer cliente autenticado. */
export function CatalogPage() {
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { items, addItem, total } = useCart();

  useEffect(() => {
    let cancelled = false;
    listarProdutos()
      .then((data) => {
        if (!cancelled) setProdutos(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Erro inesperado ao carregar produtos.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Catálogo</h1>

      {error && <ErrorMessage message={error} />}

      {!error && produtos === null && <p>Carregando produtos...</p>}

      {produtos && produtos.length === 0 && <p>Nenhum produto cadastrado ainda.</p>}

      {produtos && produtos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {produtos.map((produto) => {
            const semEstoque = produto.estoque === 0;
            return (
              <li
                key={produto.id}
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{produto.nome}</p>
                  <p className="text-sm text-gray-600">
                    R$ {produto.preco.toFixed(2)} · estoque: {produto.estoque}
                    {semEstoque && <span className="ml-2 text-red-600">(sem estoque)</span>}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={semEstoque}
                  onClick={() => addItem(produto, 1)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  Adicionar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <Link
          to="/checkout"
          className="mt-4 block rounded bg-black px-3 py-2 text-center text-sm text-white"
        >
          Ir para o carrinho ({items.length} {items.length === 1 ? "item" : "itens"} · R${" "}
          {total.toFixed(2)})
        </Link>
      )}
    </div>
  );
}
