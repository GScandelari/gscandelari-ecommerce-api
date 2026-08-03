import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { listarProdutos } from "@/api/produtos";
import { useAuth } from "@/context/AuthContext";
import { setAuthProfile } from "@/test/mocks/authContext";
import { request as mockRequest } from "@/test/mocks/apiClient";

vi.mock("@/api/apiClient", () => import("@/test/mocks/apiClient"));
vi.mock("@/context/AuthContext", () => import("@/test/mocks/authContext"));

function Demo() {
  const { isAdmin } = useAuth();
  return <span>{isAdmin ? "admin" : "nao-admin"}</span>;
}

// Task 17.1.2: exemplo mostrando os dois helpers de mock (mockApiClient +
// AuthContext mockado) funcionando juntos, sem `fetch` real e sem subir o
// Firebase Emulator Suite.
describe("mocks reutilizaveis de teste (Épico 17.1)", () => {
  beforeEach(() => {
    vi.mocked(mockRequest).mockReset();
  });

  it("mockApiClient intercepta a chamada HTTP sem fetch real", async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce([
      { id: "p1", nome: "Camiseta", preco: 49.9, estoque: 10 },
    ]);

    const produtos = await listarProdutos();

    expect(produtos).toHaveLength(1);
    expect(mockRequest).toHaveBeenCalledWith("/produtos");
  });

  it("AuthContext mockado reflete o perfil admin sem tocar firebase/auth", async () => {
    setAuthProfile("admin");
    render(<Demo />);
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
  });
});
