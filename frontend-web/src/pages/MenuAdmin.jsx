import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "./menu.css";
import { clearSession } from "../state/auth";

export default function MenuAdmin(){
  const nav = useNavigate();
  const [items, setItems] = useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        // Endpoint real (cuando esté): /admin/asistencias-hoy
        const { data } = await api.get("/admin/asistencias-hoy");
        setItems(data || []);
      }catch{
        // MOCK UI como tu diseño
        setItems([
          { id:1, lab:"A-93", materia:"Programación visual", dia:"viernes", hora:"10:00 - 12:00", estado:"Pendiente", docente:"MONTOYA MARTÍNEZ YENIZA SARAHI" },
          { id:2, lab:"L-Antenas", materia:"Tutoría", dia:"viernes", hora:"7:00 - 8:00", estado:"Registrada", docente:"AUSTRIA CORNEJO ARTURO" },
          { id:3, lab:"A-87", materia:"Estancia 1", dia:"viernes", hora:"9:00 - 10:00", estado:"Fuera de Horario", extra:"Sin Registrar", docente:"AUSTRIA CORNEJO ARTURO" },
          { id:4, lab:"L-Antenas", materia:"Tutoría", dia:"Jueves", hora:"7:00 - 8:00", estado:"No asistio", docente:"AUSTRIA CORNEJO ARTURO" },
        ]);
      }
    })();
  },[]);

  function logout(){
    clearSession();
    nav("/login-admin", { replace:true });
  }

  return (
    <div className="page-shell">
      <div className="menu-card">
        <div className="menu-head">
          <div style={{fontWeight:800, fontSize:18}}>SAL-UPP</div>
          <div className="menu-sub">Administrador</div>
        </div>

        <div className="block">
          <h3>Revisión de Asistencias hoy</h3>
          {items.map(it=>(
            <div className="class-card" key={it.id}>
              <div className="class-row">
                <div className="class-title">{it.lab} {it.materia}</div>
                <StatusBadge kind={it.estado} text={it.estado}/>
              </div>
              <div className="class-row">
                <div className="class-sub">{it.dia} {it.hora}</div>
                {it.extra && <button className="btn-pill">Ver Motivo…</button>}
              </div>
              <div style={{fontSize:12, color:"#667"}}>{it.docente}</div>
            </div>
          ))}
        </div>

        <div className="actions-grid" style={{marginTop:10}}>
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
