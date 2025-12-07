// src/pages/IncidentesPage.jsx
import { useEffect, useState } from "react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "./menu.css"; // page-shell, menu-card, etc.

const ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "resuelto", label: "Resuelto" },
];

export default function IncidentesPage() {
  const [incidentes, setIncidentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroDocente, setFiltroDocente] = useState("todos");
  const [filtroLab, setFiltroLab] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Modal detalle
  const [selectedIncident, setSelectedIncident] = useState(null);

  // ==========================
  // Cargar incidentes del backend
  // ==========================
  const loadIncidentes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/incidentes");
      const lista = data?.incidentes || [];
      setIncidentes(lista);
    } catch (err) {
      console.error("Error cargando incidentes:", err);
      setError("No se pudieron cargar los incidentes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidentes();
  }, []);

  // ==========================
  // Opciones de filtros (docentes y labs únicos)
  // ==========================
  const docentesUnicos = Array.from(
    new Set(
      (incidentes || [])
        .map((i) => i.docente_nombre)
        .filter((n) => !!n && n.trim() !== "")
    )
  );

  const labsUnicos = Array.from(
    new Set(
      (incidentes || [])
        .map((i) => i.lab_nombre)
        .filter((n) => !!n && n.trim() !== "")
    )
  );

  // ==========================
  // Aplicar filtros
  // ==========================
  const filtrados = (incidentes || []).filter((i) => {
    // Estado
    if (filtroEstado !== "todos" && i.estado !== filtroEstado) return false;

    // Docente
    if (filtroDocente !== "todos" && i.docente_nombre !== filtroDocente)
      return false;

    // Laboratorio
    if (filtroLab !== "todos" && i.lab_nombre !== filtroLab) return false;

    // Fechas
    if ((fechaDesde || fechaHasta) && i.creado_en) {
      const fecha = new Date(i.creado_en);

      if (fechaDesde) {
        const dDesde = new Date(fechaDesde + "T00:00:00");
        if (fecha < dDesde) return false;
      }
      if (fechaHasta) {
        const dHasta = new Date(fechaHasta + "T23:59:59");
        if (fecha > dHasta) return false;
      }
    }

    return true;
  });

  // ==========================
  // Contadores de estado (sobre lista filtrada)
  // ==========================
  const totalPendiente = filtrados.filter(
    (i) => i.estado === "pendiente"
  ).length;
  const totalEnProceso = filtrados.filter(
    (i) => i.estado === "en_proceso"
  ).length;
  const totalResuelto = filtrados.filter(
    (i) => i.estado === "resuelto"
  ).length;

  // ==========================
  // Cambiar estado de un incidente
  // ==========================
  const handleChangeEstado = async (id, nuevoEstado) => {
    try {
      setSavingId(id);
      await api.patch(`/incidentes/${id}/estado`, { estado: nuevoEstado });

      // Actualizar en memoria sin recargar todo
      setIncidentes((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                estado: nuevoEstado,
              }
            : i
        )
      );
    } catch (err) {
      console.error("Error actualizando estado:", err);
      alert("No se pudo actualizar el estado del incidente.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="page-shell">
      <div className="menu-card">
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Administrador</div>
        </div>

        <div className="block">
          <h3>Incidentes reportados</h3>
          <p className="class-sub">
            Aquí puedes visualizar los incidentes enviados por los docentes y
            actualizar su estado.
          </p>

          {/* Filtros */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            {/* Estado */}
            <div>
              <span style={{ fontSize: 14 }}>Estado:</span>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                style={{ padding: "4px 8px", marginLeft: 6 }}
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="resuelto">Resuelto</option>
              </select>
            </div>

            {/* Docente */}
            <div>
              <span style={{ fontSize: 14 }}>Docente:</span>
              <select
                value={filtroDocente}
                onChange={(e) => setFiltroDocente(e.target.value)}
                style={{ padding: "4px 8px", marginLeft: 6 }}
              >
                <option value="todos">Todos</option>
                {docentesUnicos.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Laboratorio */}
            <div>
              <span style={{ fontSize: 14 }}>Laboratorio:</span>
              <select
                value={filtroLab}
                onChange={(e) => setFiltroLab(e.target.value)}
                style={{ padding: "4px 8px", marginLeft: 6 }}
              >
                <option value="todos">Todos</option>
                {labsUnicos.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Rango de fechas */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 14 }}>Fecha:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                style={{ padding: "2px 4px", fontSize: 13 }}
              />
              <span style={{ fontSize: 13 }}>a</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                style={{ padding: "2px 4px", fontSize: 13 }}
              />
            </div>

            {/* Botón recargar */}
            <button
              className="btn-secondary-ghost btn-secondary"
              type="button"
              onClick={loadIncidentes}
              style={{ marginLeft: "auto" }}
            >
              Recargar
            </button>
          </div>

          {/* Contadores */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            <span>
              <strong>Pendientes:</strong> {totalPendiente}
            </span>
            <span>
              <strong>En proceso:</strong> {totalEnProceso}
            </span>
            <span>
              <strong>Resueltos:</strong> {totalResuelto}
            </span>
            <span style={{ opacity: 0.7 }}>
              (sobre resultados filtrados)
            </span>
          </div>

          {/* Estados de carga */}
          {loading && <div className="empty">Cargando incidentes…</div>}
          {error && (
            <div className="empty" style={{ color: "#b00020" }}>
              {error}
            </div>
          )}
          {!loading && !error && filtrados.length === 0 && (
            <div className="empty">
              No hay incidentes que coincidan con los filtros.
            </div>
          )}

          {/* Tabla */}
          {!loading && !error && filtrados.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Docente</th>
                    <th style={thStyle}>Laboratorio</th>
                    <th style={thStyle}>Materia / Grupo</th>
                    <th style={thStyle}>Horario</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Prioridad</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Cambiar estado</th>
                    <th style={thStyle}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((i) => (
                    <tr key={i.id}>
                      <td style={tdStyle}>
                        {i.creado_en
                          ? new Date(i.creado_en).toLocaleString()
                          : "-"}
                      </td>
                      <td style={tdStyle}>{i.docente_nombre || "-"}</td>
                      <td style={tdStyle}>{i.lab_nombre || "-"}</td>
                      <td style={tdStyle}>
                        <div>{i.materia || "-"}</div>
                        <div style={{ opacity: 0.7 }}>
                          {i.grupo ? `Grupo ${i.grupo}` : ""}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {i.hora_ini && i.hora_fin
                          ? `${i.hora_ini} - ${i.hora_fin}`
                          : "-"}
                      </td>
                      <td style={tdStyle}>{i.tipo}</td>
                      <td style={tdStyle}>{i.prioridad}</td>
                      <td style={tdStyle}>
                        <StatusBadge kind={i.estado} text={i.estado} />
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={i.estado}
                          disabled={savingId === i.id}
                          onChange={(e) =>
                            handleChangeEstado(i.id, e.target.value)
                          }
                          style={{ padding: "2px 4px", fontSize: 13 }}
                        >
                          {ESTADOS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => setSelectedIncident(i)}
                          style={{
                            padding: "2px 6px",
                            fontSize: 12,
                            borderRadius: 999,
                            border: "1px solid #ccc",
                            background: "#f8f4ff",
                            cursor: "pointer",
                          }}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETALLE */}
      {selectedIncident && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Detalle de incidente</h3>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Docente:</strong> {selectedIncident.docente_nombre}
            </p>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Laboratorio:</strong> {selectedIncident.lab_nombre}
            </p>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Materia / Grupo:</strong>{" "}
              {selectedIncident.materia}{" "}
              {selectedIncident.grupo
                ? `— Grupo ${selectedIncident.grupo}`
                : ""}
            </p>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Horario:</strong>{" "}
              {selectedIncident.hora_ini && selectedIncident.hora_fin
                ? `${selectedIncident.hora_ini} - ${selectedIncident.hora_fin}`
                : "-"}
            </p>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Tipo:</strong> {selectedIncident.tipo} —{" "}
              <strong>Prioridad:</strong> {selectedIncident.prioridad}
            </p>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Estado:</strong> {selectedIncident.estado}
            </p>
            <p style={{ fontSize: 14, marginTop: 8 }}>
              <strong>Descripción:</strong>
              <br />
              {selectedIncident.descripcion}
            </p>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button onClick={() => setSelectedIncident(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  borderBottom: "1px solid #ddd",
  textAlign: "left",
  padding: "6px 8px",
  whiteSpace: "nowrap",
};

const tdStyle = {
  borderBottom: "1px solid #eee",
  padding: "6px 8px",
  verticalAlign: "top",
};
