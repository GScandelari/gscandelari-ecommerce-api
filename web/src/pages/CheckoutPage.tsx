import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { useCart } from "@/context/CartContext";
import { criarPedido } from "@/api/pedidos";
import { ApiError } from "@/api/apiClient";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PaymentForm } from "@/components/PaymentForm";
import { stripePromise } from "@/lib/stripe";
import type { Pedido } from "@/types/pedido";

type Step = "carrinho" | "pagamento" | "sucesso";

/** RN23: monta o pedido a partir do carrinho, cria o pedido e completa o pagamento. */
export function CheckoutPage() {
  const { items, updateQuantidade, removeItem, clear, total } = useCart();
  const [step, setStep] = useState<Step>("carrinho");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmarPedido(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const criado = await criarPedido({
        itens: items.map((item) => ({ produtoId: item.produto.id, quantidade: item.quantidade })),
      });
      setPedido(criado);
      clear();
      setStep("pagamento");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro inesperado ao criar o pedido. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "carrinho" && items.length === 0) {
    return <Navigate to="/" replace />;
  }

  if (step === "carrinho") {
    return (
      <div className="mx-auto max-w-lg p-4">
        <h1 className="mb-4 text-xl font-semibold">Seu pedido</h1>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.produto.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
            >
              <div>
                <p className="font-medium">{item.produto.nome}</p>
                <p className="text-sm text-gray-600">R$ {item.produto.preco.toFixed(2)} un.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={item.produto.estoque}
                  value={item.quantidade}
                  onChange={(event) =>
                    updateQuantidade(item.produto.id, Number(event.target.value))
                  }
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.produto.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-right font-semibold">Total: R$ {total.toFixed(2)}</p>

        {error && (
          <div className="mt-3">
            <ErrorMessage message={error} />
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleConfirmarPedido}
          className="mt-4 w-full rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "Criando pedido..." : "Confirmar pedido"}
        </button>
      </div>
    );
  }

  if (step === "pagamento" && pedido) {
    if (!pedido.paymentClientSecret) {
      return (
        <div className="mx-auto max-w-lg p-4">
          <ErrorMessage message="Pedido criado, mas o pagamento nao pode ser iniciado. Fale com o suporte." />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg p-4">
        <h1 className="mb-4 text-xl font-semibold">Pagamento</h1>
        <p className="mb-3 text-sm text-gray-600">
          Pedido #{pedido.id} · Total: R$ {pedido.total.toFixed(2)}
        </p>
        <Elements stripe={stripePromise}>
          <PaymentForm
            clientSecret={pedido.paymentClientSecret}
            onSucceeded={() => setStep("sucesso")}
          />
        </Elements>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-2 text-xl font-semibold">Pagamento confirmado!</h1>
      {/* Task 15.2.5: a nuance entre confirmacao de pagamento (Stripe.js,
          neste front-end) e a transicao de STATUS do pedido para
          "confirmado" (RN12, disparada pelo webhook do Stripe) e
          deliberada - documentada aqui para nao ser confundida com defeito. */}
      <p className="mb-4 text-sm text-gray-600">
        O status do pedido só passa para <strong>confirmado</strong> quando o webhook local do
        Stripe (Stripe CLI) estiver configurado — veja o README. Caso contrário, o pedido permanece{" "}
        <strong>pendente</strong> até uma ação manual do Admin.
      </p>
      <Link to="/pedidos" className="inline-block rounded bg-black px-3 py-2 text-sm text-white">
        Ver meus pedidos
      </Link>
    </div>
  );
}
