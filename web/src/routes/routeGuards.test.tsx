import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AdminRoute } from "@/routes/AdminRoute";
import { setAuthProfile } from "@/test/mocks/authContext";

vi.mock("@/context/AuthContext", () => import("@/test/mocks/authContext"));

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/protegida"]}>
      <Routes>
        <Route path="/login" element={<span>tela de login</span>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/protegida" element={<span>conteudo protegido</span>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/login" element={<span>tela de login</span>} />
        <Route path="/" element={<span>catalogo</span>} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<span>conteudo admin</span>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// Task 17.2.2 (RN26): nao-autenticado redirecionado; autenticado nao-admin
// bloqueado de rota admin; admin acessa normalmente.
describe("ProtectedRoute / AdminRoute", () => {
  it("ProtectedRoute redireciona para /login quando nao autenticado", () => {
    setAuthProfile("anonimo");
    renderProtected();
    expect(screen.getByText("tela de login")).toBeInTheDocument();
  });

  it("ProtectedRoute renderiza o conteudo para cliente autenticado", () => {
    setAuthProfile("cliente");
    renderProtected();
    expect(screen.getByText("conteudo protegido")).toBeInTheDocument();
  });

  it("AdminRoute bloqueia cliente autenticado nao-admin (redireciona para /)", () => {
    setAuthProfile("cliente");
    renderAdmin();
    expect(screen.getByText("catalogo")).toBeInTheDocument();
  });

  it("AdminRoute permite acesso normal para admin", () => {
    setAuthProfile("admin");
    renderAdmin();
    expect(screen.getByText("conteudo admin")).toBeInTheDocument();
  });
});
