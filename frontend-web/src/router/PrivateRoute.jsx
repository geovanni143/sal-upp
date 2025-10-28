import { Navigate, Outlet } from "react-router-dom";
import { getToken, getRole } from "../state/auth";

export default function PrivateRoute({ allow = [] }) {
  const token = getToken(); const role = getRole();
  if (!token) return <Navigate to="/login" replace />;
  if (allow.length && !allow.includes(role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
