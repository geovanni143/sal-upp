import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./docente.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
// Base del servidor para abrir evidencias en /uploads
const SERVER = (import.meta.env.VITE_API_SERVER ||
  (API.endsWith("/api") ? API.slice(0, -4) : "http://localhost:4000")
).replace(/\/$/, "");

function diaLabel(d) {
  const map = {
    lu: "lunes",
    ma: "martes",
    mi: "miércoles",
    ju: "jueves",
    vi: "viernes",
    sa: "sábado",
    do: "domingo",
  };
  return map[d] || d || "";
}

function estadoLabel(e) {
  const v = String(e || "").toLowerCase();

  if (v === "registrado" || v === "registrada") return "Registrada";
  if (v === "tardio" || v === "fuera_horario" || v === "fuera de horario")
    return "Fuera de horario";
  if (v === "no_asistio" || v === "no asistió" || v === "no asistio")
    return "No asistió";
  if (v === "registro_invitado") return "Invitado";
  if (v === "pendiente") return "Pendiente";

  return e || "—";
}

function estadoClass(e) {
  const v = String(e || "").toLowerCase();

  if (v === "registrado" || v === "registrada") return "success";
  if (v === "tardio" || v === "fuera_horario" || v === "fuera de horario")
    return "danger";
  if (v === "no_asistio" || v === "no asistió" || v === "no asistio")
    return "warning";
  if (v === "pendiente") return "warning";

  return "success";
}

export default function Historial() {
  const nav = useNavigate();

  const [labText, setLabText] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // docente_id desde localStorage (igual que en tu Asistencia.jsx)
  const docenteId = useMemo(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) {
        const user = JSON.parse(u);
        if (user?.id) return String(user.id);
      }
      const uid = localStorage.getItem("user_id");
      if (uid) return String(uid);
    } catch {}
    return "";
  }, []);

  const cargar = async () => {
    try {
      setLoading(true);
      setMsg("");

      if (!docenteId) {
        setItems([]);
        setMsg("No se detectó la sesión del docente (docente_id).");
        return;
      }

      const qs = new URLSearchParams();
      qs.set("docente_id", docenteId);

      // tu backend soporta lab (texto) y/o from/to
      if (labText.trim()) qs.set("lab", labText.trim());
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const resp = await fetch(`${API}/asistencias/historial-docente?${qs.toString()}`);
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        setItems([]);
        setMsg(`No se pudo cargar historial: ${data.msg || "error"}`);
        return;
      }

      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);

      if (!list.length) setMsg("Sin registros con esos filtros.");
    } catch (e) {
      setItems([]);
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const generarPdf = () => {
    setMsg("");

    if (!docenteId) {
      setMsg("No se detectó la sesión del docente (docente_id).");
      return;
    }

    const qs = new URLSearchParams();
    qs.set("docente_id", docenteId);
    if (labText.trim()) qs.set("lab", labText.trim());
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);

    window.open(
      `${API}/asistencias/historial-docente-pdf?${qs.toString()}`,
      "_blank"
    );
  };

  // carga inicial
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page-shell">
      <div className="menu-card">
        <button className="back-btn" onClick={() => nav(-1)}>←</button>

        <h2 className="center-title">Historial</h2>

        {msg && (
          <p
            style={{
              fontWeight: 600,
              marginTop: 8,
              color: msg.startsWith("No se pudo") ? "crimson" : "#333",
            }}
          >
            {msg}
          </p>
        )}

        <div className="form">
          <input
            type="text"
            placeholder="Laboratorio (ej. A-93)"
            value={labText}
            onChange={(e) => setLabText(e.target.value)}
            disabled={loading}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={loading}
              style={{ flex: 1 }}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={loading}
              style={{ flex: 1 }}
            />
          </div>

          <button
            className="btn-primary small"
            onClick={cargar}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Filtrar"}
          </button>

          <button
            className="btn-primary small"
            onClick={generarPdf}
            disabled={loading}
          >
            Generar PDF
          </button>
        </div>

        <div className="class-list">
          {items.map((it) => {
                        console.log("ESTADO QUE LLEGA:", it.estado);
  
            const h = it.horario || {};
            const titulo = `${h.lab_nombre || "Laboratorio"}${h.materia ? ` ${h.materia}` : ""}`;
            const linea2 = `${diaLabel(h.dia)} ${h.hora_ini || ""} - ${h.hora_fin || ""}`;
            const linea3 = `${it.fecha || ""}${it.hora_registro ? ` · ${it.hora_registro}` : ""}`;

            const fotoLink = it.foto_url ? `${SERVER}${it.foto_url}` : "";
            const firmaLink = it.firma_url ? `${SERVER}${it.firma_url}` : "";

            return (
              <div key={it.id} className={`class-item ${estadoClass(it.estado)}`}>
                <p>
                  <b>{titulo}</b>
                  <br />
                  {linea2}
                  <br />
                  <span style={{ fontSize: 12, opacity: 0.85 }}>{linea3}</span>

                  {(fotoLink || firmaLink) && (
<div className="evidence-links">
  {fotoLink && (
    <a className="evidence-link" href={fotoLink} target="_blank" rel="noreferrer">
      Ver foto
    </a>
  )}
  {firmaLink && (
    <a className="evidence-link" href={firmaLink} target="_blank" rel="noreferrer">
      Ver firma
    </a>
  )}
</div>

                  )}
                </p>

                <span>{estadoLabel(it.estado)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
