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
  const [deletingId, setDeletingId] = useState(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroDocente, setFiltroDocente] = useState("todos");
  const [filtroLab, setFiltroLab] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Modal detalle
  const [selectedIncident, setSelectedIncident] = useState(null);

  // ---- NUEVO: formulario de reporte para admin ----
  const [showForm, setShowForm] = useState(false);
  const [labs, setLabs] = useState([]);
  const [loadingLabs, setLoadingLabs] = useState(false);

  const [form, setForm] = useState({
    labId: "",
    tipo: "Infraestructura",
    titulo: "",
    descripcion: "",
    prioridad: "media",
  });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formMsg, setFormMsg] = useState(null);
  // -------------------------------------------------

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
  // Cargar laboratorios cuando se abre el formulario
  // ==========================
  useEffect(() => {
    const fetchLabs = async () => {
      try {
        setLoadingLabs(true);
        const { data } = await api.get("/labs");
        const lista = Array.isArray(data) ? data : data.labs || [];
        setLabs(lista);
      } catch (err) {
        console.error("Error cargando labs:", err);
        setFormError("No se pudieron cargar los laboratorios.");
      } finally {
        setLoadingLabs(false);
      }
    };

    if (showForm && labs.length === 0) {
      fetchLabs();
    }
  }, [showForm, labs.length]);

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

  // ==========================
  // Eliminar incidente
  // ==========================
  const handleDelete = async (id) => {
    const confirmar = window.confirm(
      "¿Seguro que deseas eliminar este incidente? Esta acción no se puede deshacer."
    );
    if (!confirmar) return;

    try {
      setDeletingId(id);
      await api.delete(`/incidentes/${id}`);

      // Quitar de la lista en memoria
      setIncidentes((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Error eliminando incidente:", err);
      alert("No se pudo eliminar el incidente.");
    } finally {
      setDeletingId(null);
    }
  };

  // ==========================
  // NUEVO: manejo del formulario de reporte (admin)
  // ==========================
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormMsg(null);

    if (!form.labId || !form.titulo.trim() || !form.descripcion.trim()) {
      setFormError("Completa laboratorio, título y descripción.");
      return;
    }

    try {
      setSending(true);
      await api.post("/incidentes", {
        lab_id: form.labId, // el backend debe aceptar lab_id para admin
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        prioridad: form.prioridad,
      });

      setFormMsg("Incidente registrado correctamente.");
      setForm({
        labId: "",
        tipo: "Infraestructura",
        titulo: "",
        descripcion: "",
        prioridad: "media",
      });

      // Recargar lista para ver el nuevo registro
      await loadIncidentes();
    } catch (err) {
      console.error("Error registrando incidente:", err);
      setFormError("Ocurrió un error al registrar el incidente.");
    } finally {
      setSending(false);
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
            actualizar su estado. También puedes registrar incidentes generales
            observados en los laboratorios.
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

            {/* Botones derecha */}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 8,
              }}
            >
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setShowForm((prev) => !prev)}
              >
                {showForm ? "Cerrar formulario" : "Reportar incidente"}
              </button>

              <button
                className="btn-secondary-ghost btn-secondary"
                type="button"
                onClick={loadIncidentes}
              >
                Recargar
              </button>
            </div>
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

          {/* FORMULARIO DE NUEVO INCIDENTE (ADMIN) */}
          {showForm && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 12,
                background: "#f8f4ff",
                border: "1px solid #e0d7ff",
              }}
            >
              <h4 style={{ marginTop: 0, marginBottom: 8 }}>
                Nuevo incidente (administrador)
              </h4>

              {loadingLabs && (
                <div className="empty">Cargando laboratorios…</div>
              )}
              {!loadingLabs && labs.length === 0 && (
                <div className="empty">
                  No hay laboratorios disponibles.
                </div>
              )}

              {!loadingLabs && labs.length > 0 && (
                <form className="form-incidente" onSubmit={handleFormSubmit}>
                  {/* Laboratorio */}
                  <div className="form-group">
                    <label>Laboratorio *</label>
                    <select
                      name="labId"
                      value={form.labId}
                      onChange={handleFormChange}
                    >
                      <option value="">Selecciona un laboratorio</option>
                      {labs.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo */}
                  <div className="form-group">
                    <label>Tipo de incidente *</label>
                    <select
                      name="tipo"
                      value={form.tipo}
                      onChange={handleFormChange}
                    >
                      <option value="Infraestructura">Infraestructura</option>
                      <option value="Equipo">Equipo</option>
                      <option value="Conectividad">Conectividad</option>
                      <option value="Alumno">Alumno</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  {/* Título */}
                  <div className="form-group">
                    <label>Título breve *</label>
                    <input
                      type="text"
                      name="titulo"
                      placeholder="Ej. Cable de red dañado"
                      value={form.titulo}
                      onChange={handleFormChange}
                    />
                  </div>

                  {/* Descripción */}
                  <div className="form-group">
                    <label>Descripción del incidente *</label>
                    <textarea
                      name="descripcion"
                      rows={3}
                      placeholder="Describe qué pasó, en qué equipo, fila, banca, etc."
                      value={form.descripcion}
                      onChange={handleFormChange}
                    />
                  </div>

                  {/* Prioridad */}
                  <div className="form-group">
                    <label>Prioridad *</label>
                    <select
                      name="prioridad"
                      value={form.prioridad}
                      onChange={handleFormChange}
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>

                  {formError && (
                    <div
                      className="empty"
                      style={{ color: "#b00020", marginTop: 4 }}
                    >
                      {formError}
                    </div>
                  )}
                  {formMsg && (
                    <div
                      className="empty"
                      style={{ color: "#0a7a3b", marginTop: 4 }}
                    >
                      {formMsg}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="btn-secondary-ghost btn-secondary"
                      onClick={() => setShowForm(false)}
                      disabled={sending}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-secondary"
                      disabled={sending}
                    >
                      {sending ? "Enviando..." : "Guardar incidente"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

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
                    <th style={thStyle}>Eliminar</th>
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
                      <td style={tdStyle}>
  <button
    type="button"
    onClick={() => handleDelete(i.id)}
    disabled={deletingId === i.id}
    style={{
      padding: "2px 6px",
      fontSize: 12,
      borderRadius: 999,
      border: "1px solid #e57373",
      background: deletingId === i.id ? "#ffebee" : "#ffebee",
      color: "#b71c1c",
      cursor: deletingId === i.id ? "default" : "pointer",
    }}
  >
    {deletingId === i.id ? "Borrando..." : "Borrar"}
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
              <strong>Docente:</strong>{" "}
              {selectedIncident.docente_nombre || "-"}
            </p>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Laboratorio:</strong>{" "}
              {selectedIncident.lab_nombre || "-"}
            </p>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Materia / Grupo:</strong> {selectedIncident.materia}{" "}
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
