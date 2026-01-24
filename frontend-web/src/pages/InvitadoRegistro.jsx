import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFiltrosHistorial } from "../services/historialApi";
import { registrarInvitado } from "../services/invitadoApi";
import "./menu.css"; // reutilizamos estilos de tarjetas

const tiposInvitado = [
  { value: "DOCENTE_INVITADO", label: "Docente invitado" },
  { value: "DOCENTE_EXTERNO", label: "Docente externo" },
  { value: "ALUMNO", label: "Alumno" },
];

export default function InvitadoRegistro() {
  const nav = useNavigate();

  const [labs, setLabs] = useState([]);
  const [form, setForm] = useState({
    nombre: "",
    tipo: "DOCENTE_INVITADO",
    matricula: "",
    email: "",
    motivo: "",
    labId: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getFiltrosHistorial();
        setLabs(data.labs || []);
      } catch (err) {
        console.error(err);
        alert("No se pudieron cargar los laboratorios.");
      }
    })();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.tipo || !form.labId) {
      alert("Nombre, tipo de invitado y laboratorio son obligatorios.");
      return;
    }

    try {
      setLoading(true);
      const resp = await registrarInvitado(form);
      alert(resp.mensaje || "Registro realizado correctamente.");
      nav(-1);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      } else {
        alert("No se pudo registrar el acceso.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 520 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>
            ← Regresar
          </button>
          <h1>Registrar acceso como invitado</h1>
          <div style={{ flex: 1 }} />
        </div>

        <form onSubmit={onSubmit} className="filters-vertical">
          <label>Nombre completo</label>
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => handleChange("nombre", e.target.value)}
            placeholder="Nombre del invitado"
          />

          <label>Tipo de invitado</label>
          <select
            className="input"
            value={form.tipo}
            onChange={(e) => handleChange("tipo", e.target.value)}
          >
            {tiposInvitado.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {form.tipo === "ALUMNO" && (
            <>
              <label>Matrícula (opcional)</label>
              <input
                className="input"
                value={form.matricula}
                onChange={(e) => handleChange("matricula", e.target.value)}
                placeholder="Matrícula del alumno"
              />
            </>
          )}

          <label>Correo (opcional)</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="correo@ejemplo.com"
          />

          <label>Laboratorio</label>
          <select
            className="input"
            value={form.labId}
            onChange={(e) => handleChange("labId", e.target.value)}
          >
            <option value="">Selecciona un laboratorio</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>

          <label>Motivo del uso (opcional)</label>
          <textarea
            className="input"
            rows={3}
            value={form.motivo}
            onChange={(e) => handleChange("motivo", e.target.value)}
            placeholder="Breve descripción del uso del laboratorio"
          />

          <button
            type="submit"
            className="btn-save"
            style={{ marginTop: "16px" }}
            disabled={loading}
          >
            {loading ? "Registrando..." : "Registrar acceso"}
          </button>
        </form>

        <p className="empty" style={{ marginTop: 16, fontSize: 13 }}>
          Nota: este registro no crea una cuenta en el sistema; solo registra el
          uso del laboratorio como invitado (docente, externo o alumno).
        </p>
      </div>
    </div>
  );
}
