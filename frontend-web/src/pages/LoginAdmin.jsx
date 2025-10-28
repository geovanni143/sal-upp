import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { saveSession, getToken, getRole } from "../state/auth";
import { redirectByRole } from "../utils/redirectByRole";
import "./login.css";

export default function LoginAdmin(){
  const nav = useNavigate();
  const [username,setU] = useState("admin");     // demo
  const [password,setP] = useState("admin123");  // demo
  const [remember,setR] = useState(true);
  const [loading,setL] = useState(false);
  const [err,setErr] = useState("");

  useEffect(()=>{
    const t = getToken();
    const r = getRole();
    if (t && r) nav(redirectByRole(r), { replace:true });
  },[nav]);

  function extractRole(token, fallbackRole){
    if (fallbackRole) return fallbackRole;
    try{
      const payload = JSON.parse(atob(token.split(".")[1] || ""));
      return payload?.role || payload?.rol || "";
    }catch{ return ""; }
  }

  async function submit(e){
    e.preventDefault(); setErr(""); setL(true);
    try{
      const { data } = await api.post("/auth/login", { username, password });
      if (!data?.token) throw new Error("Respuesta inválida del servidor");
      const role = extractRole(data.token, data.role);

      // Esta pantalla es exclusiva para ADMIN (superadmin/admin_lab)
      if (!["superadmin","admin_lab"].includes(role)){
        setErr("Pantalla solo para ADMINISTRACIÓN. Si eres docente, usa el login de docente.");
        return;
      }

      saveSession({ token: data.token, role }, { remember });
      nav("/admin", { replace:true });
    }catch(ex){
      const msg = ex?.response?.status === 429
        ? (ex?.response?.data?.msg || "Cuenta bloqueada temporalmente. Intenta más tarde.")
        : (ex?.response?.data?.msg || ex?.response?.data?.error || ex?.message || "Error al iniciar sesión");
      setErr(msg);
    }finally{
      setL(false);
    }
  }

  return (
    <div className="page-login">
      <div className="login-card" role="dialog" aria-labelledby="title">
        <h1 id="title" className="brand">SAL-UPP</h1>

        <form className="form" onSubmit={submit}>
          <label className="label" htmlFor="user">Usuario Admi</label>
          <input id="user" className="input" placeholder="usuario admin"
                 value={username} onChange={e=>setU(e.target.value)} autoComplete="username" required />

          <label className="label" htmlFor="pass">Contraseña</label>
          <input id="pass" className="input" type="password" placeholder="••••••••"
                 value={password} onChange={e=>setP(e.target.value)} autoComplete="current-password" required />

          <div className="row">
            <label className="chk">
              <input type="checkbox" checked={remember} onChange={e=>setR(e.target.checked)} />
              Recuérdame
            </label>
            <Link className="link" to="/recuperar">¿Olvidaste tu contraseña?</Link>
          </div>

          <button className="btn-primary" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {err && <small className="error-msg" role="alert">{err}</small>}

          <hr className="hr" />
          <div className="secondary-links">
            <Link className="link" to="/login">Volver al login docente</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
