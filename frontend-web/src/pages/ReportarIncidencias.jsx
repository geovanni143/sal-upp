// src/pages/ReportarIncidenciaPublic.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./menu.css";

export default function ReportarIncidenciaPublic() {
  const navigate = useNavigate();

  const [labs, setLabs] = useState([]);
  const [loadingLabs, setLoadingLabs] = useState(true);

  const [form, setForm] = useState({
    labId: "",
    descripcion: "",
    prioridad: "media",
  });

  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  // Cargar laboratorios públicos
  useEffect(() => {
    (async () => {
      try {
        setLoadingLabs(true);
        const { data } = await api.get("/labs/public");
        const lista = data?.labs || [];
        setLabs(lista);
      } catch (err) {
        console.error("Error cargando labs públicos:", err);
        setLabs([]);
        setError("No se pudieron cargar los laboratorios.");
      } finally {
        setLoadingLabs(false);
      }
    })();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);

    if (!form.labId || !form.descripcion.trim()) {
      setError("Selecciona un laboratorio y describe el problema.");
      return;
    }

    try {
      setSending(true);
      await api.post("/incidentes/public", {
        lab_id: form.labId,
        descripcion: form.descripcion.trim(),
        prioridad: form.prioridad,
      });

      setMsg("Gracias, tu reporte ha sido enviado.");
      setForm({
        labId: "",
        descripcion: "",
        prioridad: "media",
      });
    } catch (err) {
      console.error("Error enviando incidente público:", err);
      setError("Ocurrió un error al enviar el reporte.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="menu-card">
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Reportar Incidencia</div>
        </div>

        <form className="block" onSubmit={handleSubmit}>
          <h3>Reportar Incidencia</h3>
          <p className="class-sub">
            Cualquier persona puede reportar un problema observado en los
            laboratorios. Tu reporte será revisado por el administrador.
          </p>

          {/* Laboratorio */}
          <div className="form-group">
            <label>Laboratorio</label>
            {loadingLabs ? (
              <div className="empty">Cargando laboratorios…</div>
            ) : (
              <select
                name="labId"
                value={form.labId}
                onChange={handleChange}
              >
                <option value="">Selecciona un laboratorio</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Descripción */}
          <div className="form-group">
            <label>Descripción del problema</label>
            <textarea
              name="descripcion"
              rows={4}
              placeholder="Describe brevemente la incidencia..."
              value={form.descripcion}
              onChange={handleChange}
            />
          </div>

          {/* Prioridad */}
          <div className="form-group">
            <label>Prioridad</label>
            <select
              name="prioridad"
              value={form.prioridad}
              onChange={handleChange}
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          {error && (
            <div className="empty" style={{ color: "#b00020" }}>
              {error}
            </div>
          )}
          {msg && (
            <div className="empty" style={{ color: "#0a7a3b" }}>
              {msg}
            </div>
          )}

          <button
            type="submit"
            className="btn-secondary"
            disabled={sending || loadingLabs}
            style={{ width: "100%", marginTop: 12 }}
          >
            {sending ? "Enviando..." : "Enviar reporte"}
          </button>

          <button
            type="button"
            className="btn-secondary-ghost btn-secondary"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => navigate("/login")}
            disabled={sending}
          >
            Volver al inicio
          </button>
        </form>
      </div>
    </div>
  );
}
