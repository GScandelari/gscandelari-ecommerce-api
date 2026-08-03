import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Nav } from "@/components/Nav";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AdminRoute } from "@/routes/AdminRoute";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { AdminProductsPage } from "@/pages/AdminProductsPage";
import { AdminOrdersPage } from "@/pages/AdminOrdersPage";
import { AdminOrderDetailPage } from "@/pages/AdminOrderDetailPage";

function Layout() {
  return (
    <div>
      <Nav />
      <Outlet />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<SignupPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/pedidos" element={<OrdersPage />} />
          <Route path="/pedidos/:id" element={<OrderDetailPage />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin/produtos" element={<AdminProductsPage />} />
          <Route path="/admin/pedidos" element={<AdminOrdersPage />} />
          <Route path="/admin/pedidos/:id" element={<AdminOrderDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
