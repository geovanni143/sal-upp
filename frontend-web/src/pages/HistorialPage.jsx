import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./menu.css";

const ESTADOS = {
  registrada: "tag-green",
  "fuera-horario": "tag-red",
  "no-asistio": "tag-orange",
};

export default function HistorialPage() {
  const nav = useNavigate();
  const { state } = useLocation();

  // Mock (reemplazar por fetch con filtros)
  const [rows] = useState([
    { id: 1, lab: "A-93", materia: "Programación Visual", dia: "viernes", hora: "10:00 - 12:00", estado: "registrada", fecha: "2025-10-10" },
    { id: 2, lab: "L-Antenas", materia: "Tutoría", dia: "viernes", hora: "07:00 - 08:00", estado: "registrada", fecha: "2025-10-10" },
    { id: 3, lab: "A-87", materia: "Estancia 1", dia: "viernes", hora: "09:00 - 10:00", estado: "fuera-horario", fecha: "2025-10-10" },
    { id: 4, lab: "A-87", materia: "Estancia 1", dia: "viernes", hora: "09:00 - 10:00", estado: "no-asistio", fecha: "2025-10-03" },
  ]);

  const [f, setF] = useState({
    lab: "", docente: "", estado: "", del: "", al: ""
  });

  const list = useMemo(() => {
    return rows.filter(r => {
      const okLab = f.lab ? r.lab === f.lab : true;
      const okDoc = f.docente ? r.materia.toLowerCase().includes(f.docente.toLowerCase()) : true; // mock
      const okEstado = f.estado ? r.estado === f.estado : true;
      const okDel = f.del ? r.fecha >= f.del : true;
      const okAl = f.al ? r.fecha <= f.al : true;
      return okLab && okDoc && okEstado && okDel && okAl;
    });
  }, [rows, f]);

  useEffect(() => {
    if (state?.motivo) {
      // podrías usarlo para prefiltros
      // console.log("Motivo:", state.motivo);
    }
  }, [state]);

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 720 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Historial</h1>
          <div style={{ flex: 1 }} />
          <button className="btn-save" onClick={() => alert("Generar PDF (pendiente backend)")}>Generar PDF</button>
        </div>

        {/* Filtros (como en Figma) */}
        <div className="filters-grid">
          <label>Laboratorio
            <input className="input" value={f.lab} onChange={e => setF({ ...f, lab: e.target.value })} placeholder="A-93, L-Antenas…" />
          </label>
          <label>Rango de Fechas (del)
            <input className="input" type="date" value={f.del} onChange={e => setF({ ...f, del: e.target.value })} />
          </label>
          <label>Rango de Fechas (al)
            <input className="input" type="date" value={f.al} onChange={e => setF({ ...f, al: e.target.value })} />
          </label>
          <label>Docente
            <input className="input" value={f.docente} onChange={e => setF({ ...f, docente: e.target.value })} placeholder="Nombre o materia…" />
          </label>
          <label>Estado
            <select value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })}>
              <option value="">Todos</option>
              <option value="registrada">Registrada</option>
              <option value="fuera-horario">Fuera de Horario</option>
              <option value="no-asistio">No asistió</option>
            </select>
          </label>
        </div>

        {/* Listado estilo tarjetas */}
        <div className="list-container">
          {list.map(r => (
            <div key={r.id} className="list-item">
              <div className="item-info">
                <h4>{r.lab} {r.materia}</h4>
                <p><b>{r.dia}</b> {r.hora}</p>
              </div>
              <span className={`tag ${ESTADOS[r.estado]}`}>
                {r.estado === "registrada" ? "Registrada" : r.estado === "fuera-horario" ? "Fuera de Horario" : "No asistió"}
              </span>
            </div>
          ))}
          {list.length === 0 && <div className="empty">Sin resultados…</div>}
        </div>
      </div>
    </div>
  );
}
