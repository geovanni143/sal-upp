import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "./menu.css";
import { clearSession, getRole } from "../state/auth";

export default function MenuDocente(){
  const nav = useNavigate();
  const [clases, setClases] = useState([]);

  useEffect(() => {
    (async () => {
      try{
        // Endpoint real (cuando esté): /docente/hoy
        const { data } = await api.get("/docente/hoy");
        setClases(data || []);
      }catch{
        // MOCK UI si el endpoint aún no está: 4 tarjetas como tu diseño
        setClases([
          { id:1, lab:"A-93", materia:"Programación visual", dia:"viernes", hora:"10:00 - 12:00", estado:"Pendiente" },
          { id:2, lab:"L-Antenas", materia:"Tutoría", dia:"viernes", hora:"7:00 - 8:00", estado:"Registrada" },
          { id:3, lab:"A-87", materia:"Estancia 1", dia:"viernes", hora:"9:00 - 10:00", estado:"Fuera de Horario", extra:"Retardo" },
          { id:4, lab:"L-Antenas", materia:"Tutoría", dia:"viernes", hora:"7:00 - 8:00", estado:"Registrada" },
        ]);
      }
    })();
  }, []);

  function logout(){
    clearSession();
    nav("/login", { replace:true });
  }

  return (
    <div className="page-shell">
      <div className="menu-card">
        <div className="menu-head">
          <div style={{fontWeight:800, fontSize:18}}>SAL-UPP</div>
          <div className="menu-sub">Docente</div>
        </div>

        <button className="big-action" onClick={()=>nav("/docente/asistencia")}>Escanear QR</button>
        <Link className="link-code" to="/docente/asistencia?modo=codigo">Ingresar con Código</Link>

        <div className="block">
          <h3>Tus clases de hoy</h3>

          {clases.map(c=>(
            <div className="class-card" key={c.id}>
              <div className="class-row">
                <div className="class-title">{c.lab} {c.materia}</div>
                <StatusBadge
                  kind={c.estado}
                  text={c.estado}
                />
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
