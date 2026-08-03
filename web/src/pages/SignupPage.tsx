import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ErrorMessage } from "@/components/ErrorMessage";

/** RN21: cadastro de cliente via Firebase Auth (Auth Emulator). */
export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password);
      navigate("/", { replace: true });
    } catch {
      setError("Nao foi possivel criar a conta. O email ja pode estar em uso.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold">Criar conta</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Senha
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        {error && <ErrorMessage message={error} />}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "Criando..." : "Criar conta"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Ja tem conta?{" "}
        <Link to="/login" className="underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
