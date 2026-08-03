import { vi } from "vitest";
import type { ReactNode } from "react";

export type AuthProfile = "anonimo" | "cliente" | "admin";

interface MockAuthState {
  user: { uid: string } | null;
  isAdmin: boolean;
  loading: boolean;
}

/**
 * Task 17.1.2: substitui `@/context/AuthContext` inteiro nos testes (via
 * `vi.mock("@/context/AuthContext", () => import("@/test/mocks/authContext"))`)
 * - mesmo padrao de mock na fronteira ja usado em services/orders e
 * services/payments (Fase 3) para `verifyInternalToken`, evitando mockar a
 * lib `firebase/auth` inteira. `setAuthProfile` cobre os 3 perfis exigidos:
 * nao-autenticado, cliente, admin.
 */
export const authState: MockAuthState = { user: null, isAdmin: false, loading: false };

export function setAuthProfile(profile: AuthProfile): void {
  if (profile === "anonimo") {
    authState.user = null;
    authState.isAdmin = false;
  } else if (profile === "cliente") {
    authState.user = { uid: "cliente-uid" };
    authState.isAdmin = false;
  } else {
    authState.user = { uid: "admin-uid" };
    authState.isAdmin = true;
  }
  authState.loading = false;
}

export const mockLogin = vi.fn();
export const mockSignup = vi.fn();
export const mockLogout = vi.fn();
export const mockRefreshClaims = vi.fn();

export function useAuth() {
  return {
    user: authState.user,
    isAdmin: authState.isAdmin,
    loading: authState.loading,
    login: mockLogin,
    signup: mockSignup,
    logout: mockLogout,
    refreshClaims: mockRefreshClaims,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return children;
}
