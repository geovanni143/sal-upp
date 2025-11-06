import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./menu.css";

/** Estados visuales del Figma */
const ESTADOS = [
  { v: "reportado", t: "Reportado", cls: "tag-red" },
  { v: "seguimiento", t: "En seguimiento", cls: "tag-amber" },
  { v: "resuelto", t: "Resuelto", cls: "tag-green" },
];

export default function IncidentesPage() {
  const nav = useNavigate();

  // Mock local (luego se cambia por fetch al backend)
  const [rows, setRows] = useState([
    { id: 1, fecha: "2025-10-06", lab: "A-93", desc: "PC sin encender", estado: "reportado" },
    { id: 2, fecha: "2025-10-06", lab: "L-Antenas", desc: "Proyector sin foco", estado: "seguimiento" },
    { id: 3, fecha: "2025-10-07", lab: "A-87", desc: "Teclado roto", estado: "resuelto" },
  ]);

  const [filtro, setFiltro] = useState({ q: "", estado: "" });

  const list = useMemo(() => {
    const t = filtro.q.trim().toLowerCase();
    return rows.filter(r =>
      (filtro.estado ? r.estado === filtro.estado : true) &&
      (`${r.fecha} ${r.lab} ${r.desc}`.toLowerCase().includes(t))
    );
  }, [rows, filtro]);

  const reportar = () => {
    // aquí normalmente abrirías un modal; por ahora, una inserción rápida:
    const desc = prompt("Describe el incidente:");
    if (!desc) return;
    setRows(prev => [
      { id: Date.now(), fecha: new Date().toISOString().slice(0, 10), lab: "—", desc, estado: "reportado" },
      ...prev,
    ]);
  };

  const cambiarEstado = (id) => {
    setRows(prev =>
      prev.map(r => r.id === id
        ? { ...r, estado: r.estado === "reportado" ? "seguimiento" : r.estado === "seguimiento" ? "resuelto" : "reportado" }
        : r
      )
    );
  };

  const eliminar = (id) => {
    if (!confirm("¿Eliminar incidente?")) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 680 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Bandeja de incidentes</h1>
          <div style={{ flex: 1 }} />
          <button className="btn-save" onClick={reportar}>+ Reportar Incidente</button>
        </div>

        {/* Filtros */}
        <div className="filters-row">
          <input
            className="input"
            placeholder="Buscar por fecha, laboratorio o descripción…"
            value={filtro.q}
            onChange={(e) => setFiltro({ ...filtro, q: e.target.value })}
          />
          <select
            value={filtro.estado}
            onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })}
          >
            <option value="">Todos</option>
            {ESTADOS.map(s => <option key={s.v} value={s.v}>{s.t}</option>)}
          </select>
          <button className="btn-secondary-ghost" onClick={() => setFiltro({ q: "", estado: "" })}>Limpiar</button>
        </div>

        {/* Tabla ligera */}
        <div className="table-like" style={{ marginTop: 8 }}>
          <div className="thead">
            <div>Fecha</div><div>Laboratorio</div><div>Descripción</div><div>Estado</div><div>Acciones</div>
          </div>
          {list.map(r => (
            <div key={r.id} className="trow">
              <div>{r.fecha}</div>
              <div>{r.lab}</div>
              <div>{r.desc}</div>
              <div>
                <span className={`tag ${ESTADOS.find(s => s.v === r.estado)?.cls}`}>{ESTADOS.find(s => s.v === r.estado)?.t}</span>
              </div>
              <div className="row-actions">
                <button className="btn-edit" onClick={() => cambiarEstado(r.id)}>Cambiar estado</button>
                <button className="btn-delete" onClick={() => eliminar(r.id)}>🗑</button>
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="empty">Sin registros…</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button className="btn-save" onClick={() => alert("Generar PDF (pendiente backend)")}>Generar PDF</button>
        </div>
      </div>
    </div>
  );
}
