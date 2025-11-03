// src/router/AppRouter.jsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";

import App from "../App.jsx";                 // tu layout con <Outlet />
import PrivateRoute from "./PrivateRoute.jsx";

import LoginDocente from "../pages/LoginDocente.jsx";
import LoginAdmin from "../pages/LoginAdmin.jsx";
import Forbidden from "../pages/Forbidden.jsx";

// Menús
import MenuDocente from "../pages/MenuDocente.jsx";
import MenuAdmin from "../pages/MenuAdmin.jsx";

// Páginas Docente
import AsistenciaDocente from "../pages/AsistenciaDocente.jsx";

// Páginas Admin (Sprint 2)
import UsersPage from "../pages/UsersPage.jsx";
import LabsPage from "../pages/LabsPage.jsx";
import DocentesPage from "../pages/DocentesPage.jsx";
import HorariosPage from "../pages/HorariosPage.jsx";

// Extras ya existentes
import Dashboard from "../pages/Dashboard.jsx";
import ReportarIncidencias from "../pages/ReportarIncidencias.jsx";

import { getToken, getRole } from "../state/auth";
import { redirectByRole } from "../utils/redirectByRole";

// Componente simple para placeholders
const WIP = ({ title }) => (
  <div style={{ padding: 16 }}>
    <h2>{title}</h2>
    <p>En construcción…</p>
  </div>
);

// Redirección inteligente en raíz
function HomeRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    const token = getToken();
    const role = getRole();
    if (!token) return nav("/login", { replace: true });
    nav(redirectByRole(role), { replace: true });
  }, [nav]);
  return null;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Layout base */}
        <Route path="/" element={<App />}>
          {/* Raíz -> redirige según rol */}
          <Route index element={<HomeRedirect />} />

          {/* Login */}
          <Route path="login" element={<LoginDocente />} />
          <Route path="login-admin" element={<LoginAdmin />} />

          {/* Acceso denegado */}
          <Route path="403" element={<Forbidden />} />

          {/* Opcionales / legacy */}
          <Route
            path="dashboard"
            element={getToken() ? <Dashboard /> : <Navigate to="/login" replace />}
          />
          <Route path="reportar-incidencia" element={<ReportarIncidencias />} />

          {/* ================= DOCENTE ================= */}
          <Route element={<PrivateRoute allow={["docente", "superadmin", "admin_lab"]} />}>
            <Route path="docente" element={<MenuDocente />} />
            <Route path="docente/asistencia" element={<AsistenciaDocente />} />
            <Route path="docente/historial" element={<WIP title="Historial de asistencias" />} />
            <Route path="docente/incidente" element={<WIP title="Reportar incidente" />} />
            <Route path="docente/perfil" element={<WIP title="Perfil docente" />} />
          </Route>

          {/* ================= ADMIN ================= */}
          <Route element={<PrivateRoute allow={["superadmin", "admin_lab"]} />}>
            <Route path="admin" element={<MenuAdmin />} />

            {/* Gestión / Señales / Reportes */}
           * <Route path="admin/users" element={<UsersPage />} /> 
            <Route path="admin/labs" element={<LabsPage />} />
            <Route path="admin/docentes" element={<DocentesPage />} />
            <Route path="admin/horarios" element={<HorariosPage />} />

            <Route path="admin/incidentes" element={<WIP title="Incidentes de Laboratorio" />} />
            <Route path="admin/historial" element={<WIP title="Historial general / Reportes" />} />
            <Route path="admin/config" element={<WIP title="Configurar" />} />
            <Route path="admin/perfil" element={<WIP title="Perfil administrador" />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<WIP title="404 — No encontrado" />} />
      </Routes>
    </BrowserRouter>
  );
}
