import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import "../menu.css";     // para page-shell, menu-card, etc.
import "./docente.css";  // por si reutilizas estilos de docente

export default function IncidenteDoc() {
  const navigate = useNavigate();

  const [clases, setClases] = useState(null); // null = cargando
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    claseId: "",
    tipo: "Infraestructura",
    titulo: "",
    descripcion: "",
    prioridad: "media",
  });

  // ==========================
  // Cargar clases de hoy (igual que en MenuDocente)
  // ==========================
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/docentes/clases-hoy");

        const adaptadas = (data.clases || []).map((c) => ({
          id: c.id,
          materia: c.materia,
          lab: c.lab_nombre,
          grupo: c.grupo,
          hora: `${c.hora_ini} - ${c.hora_fin}`,
        }));

        setClases(adaptadas);
      } catch (err) {
        console.error(err);
        setClases([]);
      }
    })();
  }, []);

  // ==========================
  // Manejar cambios de formulario
  // ==========================
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ==========================
  // Enviar incidente
  // ==========================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);

    if (!form.claseId || !form.titulo.trim() || !form.descripcion.trim()) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }

    try {
      setSending(true);
      await api.post("/incidentes", {
        clase_id: form.claseId,
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        prioridad: form.prioridad,
      });

      setMsg("Incidente reportado correctamente.");
      setForm({
        claseId: "",
        tipo: "Infraestructura",
        titulo: "",
        descripcion: "",
        prioridad: "media",
      });
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al reportar el incidente.");
    } finally {
      setSending(false);
    }
  };

  // ==========================
  // Render
  // ==========================
  return (
    <div className="page-shell">
      <div className="menu-card">
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Docente</div>
        </div>

        <div className="block">
          <h3>Reportar incidente</h3>
          <p className="class-sub">
            Registra problemas de infraestructura, equipo o situación con el grupo.
          </p>

          {clases === null && <div className="empty">Cargando clases…</div>}
          {clases?.length === 0 && (
            <div className="empty">No tienes clases programadas para hoy.</div>
          )}

          {clases && clases.length > 0 && (
            <form className="form-incidente" onSubmit={handleSubmit}>
              {/* Clase */}
              <div className="form-group">
                <label>Clase *</label>
                <select
                  name="claseId"
                  value={form.claseId}
                  onChange={handleChange}
                >
                  <option value="">Selecciona una clase</option>
                  {clases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lab} · {c.materia} · {c.hora} · Grupo {c.grupo}
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
                  onChange={handleChange}
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
                  placeholder="Ej. Proyector no enciende"
                  value={form.titulo}
                  onChange={handleChange}
                />
              </div>

              {/* Descripción */}
              <div className="form-group">
                <label>Descripción del incidente *</label>
                <textarea
                  name="descripcion"
                  rows={4}
                  placeholder="Describe qué pasó, en qué equipo o con qué alumno, etc."
                  value={form.descripcion}
                  onChange={handleChange}
                />
              </div>

              {/* Prioridad */}
              <div className="form-group">
                <label>Prioridad *</label>
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

              {error && <div className="empty" style={{ color: "#b00020" }}>{error}</div>}
              {msg && <div className="empty" style={{ color: "#0a7a3b" }}>{msg}</div>}

              <div className="grid-2" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-secondary-ghost btn-secondary"
                  onClick={() => navigate("/docente")}
                  disabled={sending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-secondary"
                  disabled={sending}
                >
                  {sending ? "Enviando..." : "Enviar incidente"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
