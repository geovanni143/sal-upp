import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./docente.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const SERVER = (import.meta.env.VITE_API_SERVER || "http://localhost:4000").replace(/\/$/, "");

function diaLabel(d) {
  const map = { lu: "lunes", ma: "martes", mi: "miércoles", ju: "jueves", vi: "viernes", sa: "sábado", do: "domingo" };
  return map[d] || d || "";
}

function estadoLabel(e) {
  const v = String(e || "").toLowerCase();
  if (v === "registrado" || v === "registrada") return "Registrada";
  if (v === "tardio" || v === "fuera_horario" || v === "fuera de horario") return "Fuera de horario";
  if (v === "no_asistio" || v === "no asistio") return "No asistió";
  if (v === "registro_invitado") return "Invitado";
  if (v === "pendiente") return "Pendiente";
  return e || "—";
}

// Mapea estado BD -> clase CSS del item
function estadoClass(e) {
  const v = String(e || "").toLowerCase();

  // Ajusta aquí si tu BD guarda estados distintos
  if (v === "registrado" || v === "registrada") return "success";
  if (v === "tardio" || v === "fuera_horario" || v === "fuera de horario") return "danger";
  if (v === "no_asistio" || v === "no asistió" || v === "no asistio") return "warning";
  if (v === "pendiente") return "warning";

  return "success";
}

export default function Historial() {
  const nav = useNavigate();

  const [labText, setLabText] = useState("");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState("");     // YYYY-MM-DD

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // docente_id desde localStorage (igual que en Asistencia.jsx)
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

      setItems(Array.isArray(data.items) ? data.items : []);
      if (!data.items?.length) setMsg("Sin registros en el rango/filtros seleccionados.");
    } catch (e) {
      setItems([]);
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page-shell">
      <div className="menu-card">
        <button className="back-btn" onClick={() => nav(-1)}>←</button>

        <h2 className="center-title">Historial</h2>

        <div className="form">
          <input
            type="text"
            placeholder="Laboratorio (ej. A-93)"
            value={labText}
            onChange={(e) => setLabText(e.target.value)}
          />

          {/* Mejor que "Rango de Fechas" en texto: dos fechas reales */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
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

          {/* Tu botón de PDF lo dejamos por ahora, luego lo conectamos */}
          <button className="btn-primary small" disabled>
            Generar PDF
          </button>
        </div>

        {msg && (
          <p style={{ marginTop: 10, fontWeight: 600, color: msg.includes("No se pudo") ? "crimson" : "#333" }}>
            {msg}
          </p>
        )}

        <div className="class-list">
          {items.map((it) => {
            const h = it.horario || {};
            const title = `${h.lab_nombre || "Lab"}${h.materia ? ` ${h.materia}` : ""}`;
            const subtitle = `${diaLabel(h.dia)} ${h.hora_ini || ""} - ${h.hora_fin || ""} · ${it.fecha || ""}`;

            return (
              <div key={it.id} className={`class-item ${estadoClass(it.estado)}`}>
                <p>
                  <b>{title}</b>
                  <br />
                  {subtitle}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <span>{estadoLabel(it.estado)}</span>

                  {/* Evidencias (opcional) */}
                  <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                    {it.foto_url && (
                      <a href={`${SERVER}${it.foto_url}`} target="_blank" rel="noreferrer">
                        Ver foto
                      </a>
                    )}
                    {it.firma_url && (
                      <a href={`${SERVER}${it.firma_url}`} target="_blank" rel="noreferrer">
                        Ver firma
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
