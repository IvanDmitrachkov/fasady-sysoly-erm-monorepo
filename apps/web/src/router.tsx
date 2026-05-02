import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ACCESS_TOKEN_KEY } from "./api/http";

function RequireAuth() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function AppLayout() {
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
          element: <AppLayout />,
          children: [{ index: true, element: <DashboardPage /> }],
        },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  { basename: "/admin" },
);
