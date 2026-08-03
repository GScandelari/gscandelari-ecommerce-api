import { auth } from "@/lib/firebase";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
}

async function authHeader(forceRefresh: boolean): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken(forceRefresh);
  return { Authorization: `Bearer ${token}` };
}

async function doFetch(
  path: string,
  options: RequestOptions,
  forceRefresh: boolean,
): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(forceRefresh)),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Nao foi possivel conectar a API. Verifique se o Firebase Emulator Suite esta rodando.",
    );
  }
}

/**
 * Cliente HTTP fino (Decisao tecnica 2): erro unificado via `ApiError`,
 * falha de rede vira um `ApiError` com `status: 0` (nunca deixa a Promise
 * rejeitar com um erro cru de `fetch`), e uma unica tentativa de retry com
 * refresh forcado do ID token em caso de 401 antes de desistir.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await doFetch(path, options, false);

  if (response.status === 401 && auth.currentUser) {
    response = await doFetch(path, options, true);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  const payload = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? "Erro inesperado na API.",
      error?.details,
    );
  }

  return payload as T;
}
