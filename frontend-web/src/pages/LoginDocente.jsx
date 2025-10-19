import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import "./login.css";

export default function LoginDocente(){
  const nav = useNavigate();
  const [username,setU] = useState("");
  const [password,setP] = useState("");
  const [remember,setR] = useState(true);
  const [loading,setL] = useState(false);
  const [err,setErr] = useState("");

  useEffect(()=>{
    const t = localStorage.getItem("token") || sessionStorage.getItem("token");
    if(t) nav("/");
  },[nav]);

  function saveToken(token){
    if(remember){ localStorage.setItem("token", token); sessionStorage.removeItem("token"); }
    else{ sessionStorage.setItem("token", token); localStorage.removeItem("token"); }
  }

  async function submit(e){
    e.preventDefault(); setErr(""); setL(true);
    try{
      const { data } = await api.post("/auth/login", { username, password });
      // VALIDAMOS ROL ANTES DE GUARDAR TOKEN
      const payload = JSON.parse(atob(data.token.split(".")[1]));
      const role = payload?.role || payload?.rol || "";
      if(role !== "docente"){
        setErr("Esta pantalla es solo para DOCENTE. Usa 'Iniciar como admi' si eres administrador.");
        return; // NO guardar token
      }
      saveToken(data.token);
      nav("/docente"); // menú docente (HU-21)
    }catch(ex){
      setErr(ex?.response?.data?.error || "Error al iniciar sesión");
    }finally{ setL(false); }
  }

  return (
    <div className="page-login">
      <div className="login-card" role="dialog" aria-labelledby="title">
        <h1 id="title" className="brand">SAL-UPP</h1>

        <form className="form" onSubmit={submit}>
          <label className="label" htmlFor="user">Usuario</label>
          <input id="user" className="input" placeholder="Ingresa tu usuario"
                 value={username} onChange={e=>setU(e.target.value)} autoComplete="username"/>

          <label className="label" htmlFor="pass">Contraseña</label>
          <input id="pass" className="input" type="password" placeholder="••••••••"
                 value={password} onChange={e=>setP(e.target.value)} autoComplete="current-password"/>

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

          {err && <small className="error-msg">{err}</small>}

          <hr className="hr" />
          <div className="secondary-links">
            <Link className="link" to="/login-admin">Iniciar como admi</Link>
            <Link className="link" to="/registro">¿No tienes acceso? solicitar registro</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
