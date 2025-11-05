import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "./menu.css";
import { clearSession } from "../state/auth";

export default function MenuDocente(){
  const nav = useNavigate();
  const [clases, setClases] = useState(null); // null = cargando

  useEffect(() => {
    (async () => {
      try{
        const { data } = await api.get("/docente/hoy");   // ← real
        setClases(Array.isArray(data) ? data : []);
      }catch{
        setClases([]); // sin mocks fijos
      }
    })();
  }, []);

  const logout = () => { clearSession(); nav("/login", { replace:true }); };

  return (
    <div className="page-shell">
      <div className="menu-card">
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Docente</div>
        </div>

        <button className="big-action" onClick={()=>nav("/docente/asistencia")}>
          Escanear QR
        </button>
        <Link className="link-code" to="/docente/asistencia?modo=codigo">
          Ingresar con Código
        </Link>

        <div className="block">
          <h3>Tus clases de hoy</h3>

          {clases === null && <div className="empty">Cargando…</div>}
          {clases?.length === 0 && <div className="empty">Sin clases programadas para hoy.</div>}

          {clases?.map(c=>(
            <div className="class-card" key={c.id}>
              <div className="class-row">
                <div className="class-title">{c.lab} {c.materia}</div>
                <StatusBadge kind={c.estado} text={c.estado}/>
              </div>
              <div className="class-row">
                <div className="class-sub">{c.dia} {c.hora}</div>
                {c.extra && <button className="btn-pill">{c.extra}</button>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid-2">
          <Link className="btn-secondary-ghost btn-secondary" to="/docente/historial">Historial...</Link>
          <Link className="btn-secondary" to="/docente/perfil">Perfil</Link>
        </div>

        <div style={{marginTop:12}}>
          <Link className="btn-wide" to="/docente/incidente">Reportar incidente</Link>
        </div>

        <button className="logout" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );
}
