import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Task 17.3.1 (RN27): confirma que `src/lib/firebase.ts` recusa inicializar
 * quando `VITE_FIREBASE_PROJECT_ID` nao tem o prefixo `demo-`. Usa
 * `vi.stubEnv` + `vi.resetModules` + import dinamico para forcar o
 * top-level do modulo a rodar de novo sob cada valor de env var testado
 * (import.meta.env e avaliado na primeira importacao do modulo).
 */
describe("src/lib/firebase.ts - guarda RN27", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("lanca erro se VITE_FIREBASE_PROJECT_ID nao comecar com 'demo-'", async () => {
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "gscandelari-ecommerce-api");
    vi.resetModules();

    await expect(import("@/lib/firebase")).rejects.toThrow(/deve comecar com "demo-"/);
  });

  it("lanca erro se VITE_FIREBASE_PROJECT_ID estiver ausente", async () => {
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "");
    vi.resetModules();

    await expect(import("@/lib/firebase")).rejects.toThrow(/deve comecar com "demo-"/);
  });

  it("inicializa normalmente quando o prefixo 'demo-' esta presente", async () => {
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "demo-gscandelari-ecommerce-api");
    vi.resetModules();

    const mod = await import("@/lib/firebase");
    expect(mod.auth).toBeDefined();
  });
});
