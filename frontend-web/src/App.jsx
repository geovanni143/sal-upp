import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import "./App.css";

export default function App(){
  const nav = useNavigate();
  const { pathname } = useLocation();

  const AUTH_ROUTES = ["/login", "/login-admin", "/registro", "/recuperar"];
  const isAuth = AUTH_ROUTES.includes(pathname);

  const logout = ()=>{
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    nav("/login");
  };

  if (isAuth) return <Outlet/>; // las pantallas de login ocupan todo

  return (
    <div className="container">
      <header className="app-header">
        <h1>SAL-UPP</h1>
        <nav className="app-nav">
          <Link to="/">Dashboard</Link>
          <Link to="/login">Login</Link>
          <button onClick={logout}>Salir</button>
        </nav>
      </header>
      <Outlet/>
    </div>
  );
}
