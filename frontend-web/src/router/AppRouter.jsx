import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";

import App from "../App.jsx";
import PrivateRoute from "./PrivateRoute.jsx";

// Login
import LoginDocente from "../pages/LoginDocente.jsx";
import LoginAdmin from "../pages/LoginAdmin.jsx";
import Forbidden from "../pages/Forbidden.jsx";

// Menús
import MenuDocente from "../pages/MenuDocente.jsx";
import MenuAdmin from "../pages/MenuAdmin.jsx";
import AdminManage from "../pages/AdminManage.jsx";

// Docente
import Asistencia from "../pages/docente/Asistencia.jsx";
import HistorialDoc from "../pages/docente/Historial.jsx";
import IncidenteDoc from "../pages/docente/Incidente.jsx";
import Codigo from "../pages/docente/Codigo.jsx";

// Admin
import UsersPage from "../pages/UsersPage.jsx";
import LabsPage from "../pages/LabsPage.jsx";
import PeriodosPage from "../pages/PeriodosPage.jsx";
import HorariosPage from "../pages/HorariosPage.jsx";
import IncidentesPage from "../pages/IncidentesPage.jsx";
import HistorialPage from "../pages/HistorialPage.jsx";
import ConfigPage from "../pages/ConfigPage.jsx";

// PERFIL ÚNICO
import PerfilPage from "../pages/PerfilPage.jsx";

// Otros
import QRGenerator from "../pages/QRGenerator.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import ReportarIncidencias from "../pages/ReportarIncidencias.jsx";

import { getToken, getRole } from "../state/auth";
import { redirectByRole } from "../utils/redirectByRole";

/* =========================
   HOME REDIRECT
========================= */
function HomeRedirect() {
  const nav = useNavigate();

  useEffect(() => {
    const token = getToken();
    const role = getRole();

    if (!token) {
      nav("/login", { replace: true });
      return;
    }

    nav(redirectByRole(role), { replace: true });
  }, [nav]);

  return null;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ===== PERFIL (SIN LAYOUT) ===== */}
        <Route
          element={
            <PrivateRoute allow={["docente", "admin", "admin_lab", "superadmin"]} />
          }
        >
          <Route path="/docente/perfil" element={<PerfilPage />} />
          <Route path="/admin/perfil" element={<PerfilPage />} />
        </Route>

        {/* ===== APP GENERAL ===== */}
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/login" replace />} />
          <Route path="home" element={<HomeRedirect />} />

          <Route path="login" element={<LoginDocente />} />
          <Route path="login-admin" element={<LoginAdmin />} />
          <Route path="403" element={<Forbidden />} />

          <Route
            path="dashboard"
            element={getToken() ? <Dashboard /> : <Navigate to="/login" replace />}
          />

          <Route path="reportar-incidencia" element={<ReportarIncidencias />} />

          {/* DOCENTE */}
          <Route
            element={
              <PrivateRoute allow={["docente", "admin", "admin_lab", "superadmin"]} />
            }
          >
            <Route path="docente" element={<MenuDocente />} />
            <Route path="docente/asistencia" element={<Asistencia />} />
            <Route path="docente/codigo" element={<Codigo />} />
            <Route path="docente/historial" element={<HistorialDoc />} />
            <Route path="docente/incidente" element={<IncidenteDoc />} />
          </Route>

          {/* ADMIN */}
          <Route
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]} />
            }
          >
            <Route path="admin" element={<MenuAdmin />} />
            <Route path="admin/gestionar" element={<AdminManage />} />
            <Route path="admin/users" element={<UsersPage />} />
            <Route path="admin/labs" element={<LabsPage />} />
            <Route path="admin/periodos" element={<PeriodosPage />} />
            <Route path="admin/horarios" element={<HorariosPage />} />
            <Route path="admin/incidentes" element={<IncidentesPage />} />
            <Route path="admin/historial" element={<HistorialPage />} />
            <Route path="admin/config" element={<ConfigPage />} />
            <Route path="admin/generar-qr" element={<QRGenerator />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route
          path="*"
          element={<h2 style={{ padding: 16 }}>404 — No encontrado</h2>}
        />
      </Routes>
    </BrowserRouter>
  );
}
