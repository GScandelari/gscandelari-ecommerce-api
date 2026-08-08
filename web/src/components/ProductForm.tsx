import { useState, type FormEvent } from "react";
import type { ProdutoInput } from "@/types/produto";

interface ProductFormProps {
  initial?: ProdutoInput;
  onSubmit: (data: ProdutoInput) => Promise<void>;
  onCancel: () => void;
}

interface FieldErrors {
  nome?: string;
  preco?: string;
  estoque?: string;
}

/**
 * Task 16.1.2: validacao client-side minima espelhando (sem duplicar como
 * fonte de verdade) a validacao Zod ja existente no backend
 * (services/orders/src/schemas/produto.schema.ts): nome obrigatorio, preco > 0,
 * estoque inteiro >= 0.
 */
function validate(data: ProdutoInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!data.nome.trim()) errors.nome = "Nome é obrigatório.";
  if (!(data.preco > 0)) errors.preco = "Preço deve ser maior que zero.";
  if (!Number.isInteger(data.estoque) || data.estoque < 0) {
    errors.estoque = "Estoque deve ser um número inteiro maior ou igual a zero.";
  }
  return errors;
}

export function ProductForm({ initial, onSubmit, onCancel }: ProductFormProps) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [preco, setPreco] = useState(initial?.preco?.toString() ?? "");
  const [estoque, setEstoque] = useState(initial?.estoque?.toString() ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const data: ProdutoInput = {
      nome,
      preco: Number(preco),
      estoque: Number(estoque),
    };
    const fieldErrors = validate(data);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded border border-gray-200 p-3"
    >
      <label className="flex flex-col gap-1 text-sm">
        Nome
        <input
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        />
        {errors.nome && <span className="text-xs text-red-600">{errors.nome}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Preço
        <input
          type="number"
          step="0.01"
          value={preco}
          onChange={(event) => setPreco(event.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        />
        {errors.preco && <span className="text-xs text-red-600">{errors.preco}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Estoque
        <input
          type="number"
          step="1"
          value={estoque}
          onChange={(event) => setEstoque(event.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        />
        {errors.estoque && <span className="text-xs text-red-600">{errors.estoque}</span>}
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
