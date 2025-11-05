import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import "./App.css";

export default function App() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  // Rutas de autenticación (solo muestran el card de login)
  const AUTH_ROUTES = ["/login", "/login-admin", "/registro", "/recuperar"];
  const isAuth = AUTH_ROUTES.includes(pathname);

  // Rutas con layout mínimo de “pantalla completa” (sin header)
  const MINIMAL_REGEX = /^\/(docente|admin)(\/|$)/;
  const isMinimal = MINIMAL_REGEX.test(pathname);

  const logout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    nav("/login", { replace: true });
  };

  // Login / registro: render directo sin header
  if (isAuth) return <Outlet />;

  return (
    <div className={`container ${isMinimal ? "minimal" : ""}`}>
      {!isMinimal && (
        <header className="app-header">
          <h1>SAL-UPP</h1>
          <nav className="app-nav">
            <Link to="/">Dashboard</Link>
            <Link to="/login">Login</Link>
            <Link to="/reportar-incidencia">Reportar Incidencia</Link>
            <button onClick={logout}>Salir</button>
          </nav>
        </header>
      )}
      <Outlet />
    </div>
  );
}
