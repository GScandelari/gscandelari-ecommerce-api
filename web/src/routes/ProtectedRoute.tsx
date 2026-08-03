import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/** RN26: qualquer rota que exija apenas um usuario autenticado (cliente ou admin). */
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-4 text-center">Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
