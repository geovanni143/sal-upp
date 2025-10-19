import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import LoginDocente from "./pages/LoginDocente.jsx";
import LoginAdmin from "./pages/LoginAdmin.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import "./index.css";

// Placeholders (puedes cambiarlos por páginas reales)
const Recuperar = () => <div className="container"><h2>Recuperar contraseña (WIP)</h2></div>;
const Registro  = () => <div className="container"><h2>Solicitud de registro (WIP)</h2></div>;
const DocenteHome = () => <div className="container"><h2>Menú Docente (HU-21)</h2></div>;
const AdminHome   = () => <div className="container"><h2>Panel Admin (WIP)</h2></div>;

const hasToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const router = createBrowserRouter([
  { path: "/", element: <App/>,
    children: [
      { path: "/", element: hasToken() ? <Dashboard/> : <LoginDocente/> },
      { path: "/login", element: <LoginDocente/> },
      { path: "/login-admin", element: <LoginAdmin/> },
      { path: "/recuperar", element: <Recuperar/> },
      { path: "/registro", element: <Registro/> },
      { path: "/docente", element: <DocenteHome/> },
      { path: "/admin", element: <AdminHome/> },
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
