import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css"; // usa tu mismo estilo visual

export default function ReportarIncidencias() {
  const [lab, setLab] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("Media");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    // simulación de envío
    setTimeout(() => {
      console.log("📩 Incidencia reportada:", { lab, descripcion, prioridad });
      setLoading(false);
      setMsg("✅ Incidencia reportada con éxito.");
      setLab("");
      setDescripcion("");
      setPrioridad("Media");
    }, 1000);
  }

  return (
    <div className="page-login">
      <div className="login-card" role="dialog" aria-labelledby="title">
        <h1 id="title" className="brand">Reportar Incidencia</h1>

        <form className="form" onSubmit={handleSubmit}>
          <label className="label" htmlFor="lab">Laboratorio</label>
          <input
            id="lab"
            className="input"
            placeholder="Ej. Laboratorio A-93"
            value={lab}
            onChange={(e) => setLab(e.target.value)}
            required
          />

          <label className="label" htmlFor="desc">Descripción del problema</label>
          <textarea
            id="desc"
            className="input"
            placeholder="Describe brevemente la incidencia..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows="4"
            required
          ></textarea>

          <label className="label" htmlFor="prio">Prioridad</label>
          <select
            id="prio"
            className="input"
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value)}
          >
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
          </select>

          <button className="btn-primary" disabled={loading}>
            {loading ? "Enviando..." : "Enviar reporte"}
          </button>

          {msg && <small className="success-msg" style={{ color: "green" }}>{msg}</small>}

          <hr className="hr" />

          <button
            type="button"
            className="btn-secondary"
            onClick={() => nav("/login")}
          >
            Volver al inicio
          </button>
        </form>
      </div>
    </div>
  );
}
