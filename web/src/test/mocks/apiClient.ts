import { vi } from "vitest";

/**
 * Task 17.1.2: substitui `@/api/apiClient` inteiro nos testes (via
 * `vi.mock("@/api/apiClient", () => import("@/test/mocks/apiClient"))`) -
 * `request` intercepta toda chamada HTTP que `@/api/produtos` e
 * `@/api/pedidos` fariam, sem `fetch` real. `ApiError` tem o mesmo shape da
 * classe real para os `instanceof` checks das paginas continuarem validos.
 */
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

export const request = vi.fn();
