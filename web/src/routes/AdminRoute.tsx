import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * RN25/RN26: UI de admin escondida de quem nao tem a custom claim `admin`.
 * O backend continua sendo a fonte real de autorizacao (RN07) - esta rota e
 * apenas reforco de UX.
 */
export function AdminRoute() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <p className="p-4 text-center">Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}
