// src/router/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { getToken, getRole } from "../state/auth";

export default function PrivateRoute({ allow = [], children }) {
  const loc = useLocation();

  const token = getToken();
  const role = getRole();

  // Sin sesión -> login
  if (!token || !role) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  // No permitido -> 403
  if (allow?.length && !allow.includes(role)) {
    return <Navigate to="/403" replace />;
  }

  // OK
  return children;
}
