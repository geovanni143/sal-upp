import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, useNavigate, Navigate } from "react-router-dom";

import App from "./App.jsx";
import LoginDocente from "./pages/LoginDocente.jsx";
import LoginAdmin from "./pages/LoginAdmin.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ReportarIncidencias from "./pages/ReportarIncidencias.jsx"; // 🔹 nueva importación

import PrivateRoute from "./router/PrivateRoute.jsx";
// import Forbidden from "./pages/Forbidden.jsx";

import { getToken, getRole } from "./state/auth";
import { redirectByRole } from "./utils/redirectByRole";
import "./index.css";

// =======================
// Páginas temporales
// =======================
const Recuperar = () => (
  <div className="container"><h2>Recuperar contraseña (WIP)</h2></div>
);

const Registro = () => (
  <div className="container"><h2>Solicitud de registro (WIP)</h2></div>
);

const DocenteHome = () => (
  <div className="container"><h2>Menú Docente</h2></div>
);

const AdminHome = () => (
  <div className="container"><h2>Panel Admin</h2></div>
);

const ManttoHome = () => (
  <div className="container"><h2>Panel Mantenimiento</h2></div>
);

// =======================
// Redirección inteligente sin bucles
// =======================
function HomeRedirect() {
  const nav = useNavigate();

  useEffect(() => {
    const token = getToken();
    const role = getRole();

    if (!token) {
      nav("/login", { replace: true });
      return;
    }

    const path = redirectByRole(role);
    if (window.location.pathname !== path) {
      nav(path, { replace: true });
    }
  }, [nav]);

  return null;
}

// =======================
// Rutas principales
// =======================
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // 🔹 Página raíz: redirección automática según rol
      { index: true, element: <HomeRedirect /> },

      // 🔹 Login (docente y admin)
      { path: "login", element: <LoginDocente /> },
      { path: "login-admin", element: <LoginAdmin /> },
      { path: "reportar-incidencia", element: <ReportarIncidencias /> },
      // 🔹 Recuperación y registro
      { path: "recuperar", element: <Recuperar /> },
      { path: "registro", element: <Registro /> },

      // 🔹 Dashboard (temporal)
      { path: "dashboard", element: getToken() ? <Dashboard /> : <Navigate to="/login" replace /> },

      // 🔹 Áreas protegidas por rol
      {
        element: <PrivateRoute allow={["superadmin", "admin_lab"]} />,
        children: [{ path: "admin", element: <AdminHome /> }],
      },
      {
        element: <PrivateRoute allow={["docente"]} />,
        children: [
          { path: "docente", element: <DocenteHome /> },
           
        ],
      },
      {
        element: <PrivateRoute allow={["mantenimiento"]} />,
        children: [{ path: "mantenimiento", element: <ManttoHome /> }],
      },

      // 🔹 Página 403 opcional
      // { path: "403", element: <Forbidden /> },
    ],
  },

  // 🔹 Catch-all (rutas no encontradas)
  { path: "*", element: <Navigate to="/" replace /> },
]);

// =======================
// Renderizado principal
// =======================
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
