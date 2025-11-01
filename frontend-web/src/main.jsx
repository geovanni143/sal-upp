import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

import App from "./App.jsx";
import LoginDocente from "./pages/LoginDocente.jsx";
import LoginAdmin from "./pages/LoginAdmin.jsx";
import Dashboard from "./pages/Dashboard.jsx";

import PrivateRoute from "./router/PrivateRoute.jsx";
import Forbidden from "./pages/Forbidden.jsx";

import { getToken, getRole } from "./state/auth";
import "./index.css";

// Placeholders (cámbialos por páginas reales cuando las tengas)
const Recuperar = () => <div className="container"><h2>Recuperar contraseña (WIP)</h2></div>;
const Registro  = () => <div className="container"><h2>Solicitud de registro (WIP)</h2></div>;
const DocenteHome = () => <div className="container"><h2>Menú Docente</h2></div>;
const AdminHome   = () => <div className="container"><h2>Panel Admin</h2></div>;
const ManttoHome  = () => <div className="container"><h2>Panel Mantenimiento</h2></div>;

// Redirección inteligente según rol
function HomeRedirect() {
  const token = getToken();
  const role = getRole();
  if (!token) return <Navigate to="/login" replace />;

  if (["superadmin", "admin_lab"].includes(role)) return <Navigate to="/admin" replace />;
  if (role === "docente") return <Navigate to="/docente" replace />;
  if (role === "mantenimiento") return <Navigate to="/mantenimiento" replace />;

  return <Navigate to="/403" replace />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // Raíz: si hay sesión redirige por rol; si no, lleva a /login
      { index: true, element: <HomeRedirect /> },

      // Login (puedes dejar ambos de momento)
      { path: "login", element: <LoginDocente /> },
      { path: "login-admin", element: <LoginAdmin /> },

      // Recuperación/registro (WIP)
      { path: "recuperar", element: <Recuperar /> },
      { path: "registro", element: <Registro /> },

      // Ruta pública temporal para ver Dashboard si lo usas como landing interna
      // (puedes protegerla si es necesario)
      { path: "dashboard", element: getToken() ? <Dashboard /> : <Navigate to="/login" replace /> },

      // Rutas protegidas por rol (sin alumnos)
      {
        element: <PrivateRoute allow={["superadmin", "admin_lab"]} />,
        children: [{ path: "admin", element: <AdminHome /> }],
      },
      {
        element: <PrivateRoute allow={["docente"]} />,
        children: [{ path: "docente", element: <DocenteHome /> }],
      },
      {
        element: <PrivateRoute allow={["mantenimiento"]} />,
        children: [{ path: "mantenimiento", element: <ManttoHome /> }],
      },

      // Acceso denegado
      { path: "403", element: <Forbidden /> },
    ],
  },
  // Catch-all opcional:
  { path: "*", element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
