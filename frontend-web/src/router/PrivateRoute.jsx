import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getToken, getRole } from "../state/auth";

export default function PrivateRoute({ allow = [] }) {
  const token = getToken();
  const role  = getRole();
  const loc   = useLocation();

  if (!token) {
    const target = loc.pathname.startsWith("/admin") ? "/login-admin" : "/login";
    return <Navigate to={target} replace />;
  }

  if (role === "superadmin") return <Outlet />;      // pasa siempre
  if (allow.length && !allow.includes(role)) return <Navigate to="/403" replace />;

  return <Outlet />;
}
