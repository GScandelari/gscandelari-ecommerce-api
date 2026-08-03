import { useState, type FormEvent } from "react";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ErrorMessage } from "@/components/ErrorMessage";

interface PaymentFormProps {
  clientSecret: string;
  onSucceeded: () => void;
}

/**
 * Task 15.2.4 (RN23 fim a fim): confirma o pagamento no Stripe usando o
 * `paymentClientSecret` retornado por `POST /pedidos`. Cartao de teste
 * 4242 4242 4242 4242 -> sucesso; 4000 0000 0000 0002 -> recusa, com a
 * mensagem exibida exatamente como o Stripe.js retorna.
 */
export function PaymentForm({ clientSecret, onSucceeded }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Nao foi possivel confirmar o pagamento.");
      return;
    }

    if (result.paymentIntent?.status === "succeeded") {
      onSucceeded();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="rounded border border-gray-300 px-3 py-2">
        <CardElement />
      </div>
      {error && <ErrorMessage message={error} />}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {submitting ? "Confirmando pagamento..." : "Pagar"}
      </button>
    </form>
  );
}
