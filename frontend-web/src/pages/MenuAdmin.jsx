import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "./menu.css";
import { clearSession } from "../state/auth";

export default function MenuAdmin(){
  const nav = useNavigate();
  const [items, setItems] = useState(null);

  useEffect(()=>{ (async()=>{
    try{
      const { data } = await api.get("/admin/asistencias-hoy"); // real
      setItems(Array.isArray(data) ? data : []);
    }catch{
      setItems([]); // sin mocks
    }
  })(); },[]);

  const logout = () => { clearSession(); nav("/login-admin", { replace:true }); };

  return (
    <div className="page-shell">
      <div className="menu-card">
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Administrador</div>
        </div>

        <div className="block">
          <h3>Revisión de Asistencias hoy</h3>

          {items === null && <div className="empty">Cargando…</div>}
          {items?.length === 0 && <div className="empty">Sin registros hoy.</div>}

          {items?.map(it=>(
            <div className="class-card" key={it.id}>
              <div className="class-row">
                <div className="class-title">{it.lab} {it.materia}</div>
                <StatusBadge kind={it.estado} text={it.estado}/>
              </div>
              <div className="class-row">
                <div className="class-sub">{it.dia} {it.hora}</div>
                {it.extra && <button className="btn-pill">Ver Motivo…</button>}
              </div>
              {it.docente && <div style={{fontSize:12, color:"#667"}}>{it.docente}</div>}
            </div>
          ))}
        </div>

        <div className="actions-grid">
          <Link className="btn-secondary" to="/admin/incidentes">Incidentes de Laboratorio</Link>
          <Link className="btn-secondary" to="/admin/users">Gestionar</Link>
          <Link className="btn-secondary-ghost btn-secondary" to="/admin/perfil">Perfil</Link>
          <Link className="btn-secondary-ghost btn-secondary" to="/admin/historial">Historial</Link>
          <Link className="btn-secondary-ghost btn-secondary" to="/admin/config">Configurar</Link>
        </div>

        <button className="logout" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );
}
