interface ErrorMessageProps {
  message: string;
}

/** Renderiza erros de `ApiError`/validacao de forma consistente (Task 15.1.2). */
export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {message}
    </div>
  );
}
