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

// Perfil
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

    if (!token || !role) {
      nav("/login", { replace: true });
      return;
    }

    nav(redirectByRole(role), { replace: true });
  }, [nav]);

  return null;
}

/* =========================
   ROUTER PRINCIPAL
========================= */
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ======================
            APP CON LAYOUT <App />
        ====================== */}
        <Route path="/" element={<App />}>

          {/* ---------- PUBLIC ---------- */}
          <Route index element={<Navigate to="/login" replace />} />
          <Route path="login" element={<LoginDocente />} />
          <Route path="login-admin" element={<LoginAdmin />} />
          <Route path="403" element={<Forbidden />} />
          <Route path="reportar-incidencia" element={<ReportarIncidencias />} />

          {/* ---------- HOME REDIRECT ---------- */}
          <Route path="home" element={<HomeRedirect />} />

          {/* ---------- DASHBOARD (GENÉRICO) ---------- */}
          <Route
            path="dashboard"
            element={
              <PrivateRoute allow={["docente", "admin", "admin_lab", "superadmin"]}>
                <Dashboard />
              </PrivateRoute>
            }
          />

          {/* ======================
              PERFIL (COMPARTIDO)
          ====================== */}
          <Route
            path="docente/perfil"
            element={
              <PrivateRoute allow={["docente", "admin", "admin_lab", "superadmin"]}>
                <PerfilPage />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/perfil"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <PerfilPage />
              </PrivateRoute>
            }
          />

          {/* ======================
              DOCENTE
          ====================== */}
          <Route
            path="docente"
            element={
              <PrivateRoute allow={["docente", "admin", "admin_lab", "superadmin"]}>
                <MenuDocente />
              </PrivateRoute>
            }
          />

          <Route
            path="docente/asistencia"
            element={
              <PrivateRoute allow={["docente", "admin", "admin_lab", "superadmin"]}>
                <Asistencia />
              </PrivateRoute>
            }
          />

          <Route
            path="docente/codigo"
            element={
              <PrivateRoute allow={["docente", "admin", "admin_lab", "superadmin"]}>
                <Codigo />
              </PrivateRoute>
            }
          />

          <Route
            path="docente/historial"
            element={
              <PrivateRoute allow={["docente", "admin", "admin_lab", "superadmin"]}>
                <HistorialDoc />
              </PrivateRoute>
            }
          />

          <Route
            path="docente/incidente"
            element={
              <PrivateRoute allow={["docente", "admin", "admin_lab", "superadmin"]}>
                <IncidenteDoc />
              </PrivateRoute>
            }
          />

          {/* ======================
              ADMIN
          ====================== */}
          <Route
            path="admin"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <MenuAdmin />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/gestionar"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <AdminManage />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/users"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <UsersPage />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/labs"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <LabsPage />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/periodos"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <PeriodosPage />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/horarios"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <HorariosPage />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/incidentes"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <IncidentesPage />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/historial"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <HistorialPage />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/config"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <ConfigPage />
              </PrivateRoute>
            }
          />

          <Route
            path="admin/generar-qr"
            element={
              <PrivateRoute allow={["admin", "admin_lab", "superadmin"]}>
                <QRGenerator />
              </PrivateRoute>
            }
          />

        </Route>

        {/* ---------- 404 ---------- */}
        <Route
          path="*"
          element={<h2 style={{ padding: 16 }}>404 — No encontrado</h2>}
        />

      </Routes>
    </BrowserRouter>
  );
}
