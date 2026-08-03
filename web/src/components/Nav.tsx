import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function Nav() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-semibold">
          gscandelari-ecommerce-api
        </Link>
        {user && (
          <>
            <Link to="/" className="text-sm text-gray-600 hover:text-black">
              Catálogo
            </Link>
            <Link to="/pedidos" className="text-sm text-gray-600 hover:text-black">
              Meus pedidos
            </Link>
          </>
        )}
        {isAdmin && (
          <>
            <Link to="/admin/produtos" className="text-sm text-gray-600 hover:text-black">
              Admin · Produtos
            </Link>
            <Link to="/admin/pedidos" className="text-sm text-gray-600 hover:text-black">
              Admin · Pedidos
            </Link>
          </>
        )}
      </div>
      {user && (
        <button
          type="button"
          onClick={handleLogout}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          Sair
        </button>
      )}
    </nav>
  );
}
