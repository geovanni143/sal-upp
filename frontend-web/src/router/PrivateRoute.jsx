import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getToken, getRole } from "../state/auth";

export default function PrivateRoute({ allow = [] }) {
  const token = getToken();
  const role = getRole();
  const location = useLocation();

  // 🚫 Si no hay token → enviar a login
  if (!token) {
    // Evita bucles si ya estás en /login
    if (location.pathname !== "/login") {
      return <Navigate to="/login" replace />;
    }
    return null;
  }

  // 🚫 Si el rol no está permitido → redirigir a página de error
  if (allow.length && !allow.includes(role)) {
    if (location.pathname !== "/403") {
      return <Navigate to="/403" replace />;
    }
    return null;
  }

  // ✅ Si pasa todas las verificaciones, renderiza el contenido
  return <Outlet />;
}
