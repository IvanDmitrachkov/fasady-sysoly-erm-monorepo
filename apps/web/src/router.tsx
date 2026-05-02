import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { ShellLayout } from "./layouts/ShellLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardHome } from "./pages/DashboardHome";
import { OrdersPage } from "./pages/OrdersPage";
import { OrdersBoardPage } from "./pages/OrdersBoardPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrderCuttingPage } from "./pages/OrderCuttingPage";
import { StagesPage } from "./pages/StagesPage";
import { FacadeCatalogPage } from "./pages/FacadeCatalogPage";
import { UsersPage } from "./pages/UsersPage";
import { AuditPage } from "./pages/AuditPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ACCESS_TOKEN_KEY } from "./api/http";

function RequireAuth() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export const router = createBrowserRouter(
  [
    { path: "login", element: <LoginPage /> },
    {
      element: <RequireAuth />,
      children: [
        {
          path: "/",
          element: <ShellLayout />,
          children: [
            { index: true, element: <DashboardHome /> },
            { path: "orders/board", element: <OrdersBoardPage /> },
            { path: "orders/:orderId/cutting", element: <OrderCuttingPage /> },
            { path: "orders/:orderId", element: <OrderDetailPage /> },
            { path: "orders", element: <OrdersPage /> },
            { path: "stages", element: <StagesPage /> },
            { path: "facade-catalog", element: <FacadeCatalogPage /> },
            { path: "users", element: <UsersPage /> },
            { path: "customers", element: <CustomersPage /> },
            { path: "audit", element: <AuditPage /> },
          ],
        },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  { basename: "/admin" },
);
