import { useEffect, useState } from "react";
import { atualizarProduto, criarProduto, listarProdutos, removerProduto } from "@/api/produtos";
import { ApiError } from "@/api/apiClient";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProductForm } from "@/components/ProductForm";
import type { Produto, ProdutoInput } from "@/types/produto";

/** RN25: CRUD de produtos, exclusivo do Admin (rota ja protegida por <AdminRoute>). */
export function AdminProductsPage() {
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Produto | null>(null);

  function reload(): void {
    listarProdutos()
      .then(setProdutos)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Erro inesperado ao carregar produtos.");
      });
  }

  useEffect(reload, []);

  async function handleCreate(data: ProdutoInput): Promise<void> {
    await criarProduto(data);
    setShowCreateForm(false);
    reload();
  }

  async function handleUpdate(data: ProdutoInput): Promise<void> {
    if (!editing) return;
    await atualizarProduto(editing.id, data);
    setEditing(null);
    reload();
  }

  async function handleDelete(): Promise<void> {
    if (!pendingDelete) return;
    await removerProduto(pendingDelete.id);
    setPendingDelete(null);
    reload();
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin · Produtos</h1>
        {!showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="rounded bg-black px-3 py-1 text-sm text-white"
          >
            Novo produto
          </button>
        )}
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreateForm && (
        <div className="mb-4">
          <ProductForm onSubmit={handleCreate} onCancel={() => setShowCreateForm(false)} />
        </div>
      )}

      {produtos === null && !error && <p>Carregando produtos...</p>}

      {produtos && (
        <ul className="flex flex-col gap-2">
          {produtos.map((produto) =>
            editing?.id === produto.id ? (
              <li key={produto.id}>
                <ProductForm
                  initial={produto}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={produto.id}
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{produto.nome}</p>
                  <p className="text-sm text-gray-600">
                    R$ {produto.preco.toFixed(2)} · estoque: {produto.estoque}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(produto)}
                    className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(produto)}
                    className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDialog
          message={`Remover o produto "${pendingDelete.nome}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
