import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { saveSession, getToken, getRole } from "../state/auth";
import { redirectByRole } from "../utils/redirectByRole";
import "./login.css";

export default function LoginAdmin() {
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [remember, setR] = useState(true);
  const [loading, setL] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = getToken();
    const r = getRole();
    if (t && r) nav(redirectByRole(r), { replace: true });
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setL(true);
    try {
      const { data } = await api.post("/login", { username, password });
      if (!data?.token || !data?.user) throw new Error("Respuesta inválida del servidor");

      const rol = data.user.rol || data.user.role;

      // Admin screen: ADMIN o SUPERADMIN
      if (!(rol === "admin" || rol === "superadmin")) {
        setErr("Pantalla exclusiva para ADMINISTRACIÓN.");
        return;
      }

      saveSession({ token: data.token, user: data.user }, { remember });
      nav(redirectByRole(rol), { replace: true });
    } catch (ex) {
      const msg = ex?.response?.data?.error || ex?.message || "Error al iniciar sesión";
      setErr(msg);
    } finally {
      setL(false);
    }
  }

  return (
    <div className="page-login">
      <div className="login-card" role="dialog" aria-labelledby="title">
        <h1 id="title" className="brand">SAL-UPP</h1>

        <form className="form" onSubmit={submit}>
          <label className="label" htmlFor="user">Usuario Admin</label>
          <input id="user" className="input" value={username} onChange={e=>setU(e.target.value)} required />

          <label className="label" htmlFor="pass">Contraseña</label>
          <input id="pass" className="input" type="password" value={password} onChange={e=>setP(e.target.value)} required />

          <div className="row">
            <label className="chk">
              <input type="checkbox" checked={remember} onChange={e=>setR(e.target.checked)} />
              Recuérdame
            </label>
            <Link className="link" to="/recuperar">¿Olvidaste tu contraseña?</Link>
          </div>

          <button className="btn-primary" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>

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
