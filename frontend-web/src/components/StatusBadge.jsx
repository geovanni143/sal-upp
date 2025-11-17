// src/components/StatusBadge.jsx
import "./status-badge.css";

export default function StatusBadge({ kind, text }) {
  const k = (kind || "").toLowerCase();

  let extra = "status-pill--default";

  if (k === "en curso" || k === "pendiente") {
    extra = "status-pill--pending";
  } else if (k === "próxima" || k === "proxima") {
    extra = "status-pill--upcoming";
  } else if (k === "registrada" || k === "registrado") {
    extra = "status-pill--ok";
  } else if (
    k === "fuera de horario" ||
    k === "registrada fuera de horario"
  ) {
    extra = "status-pill--warn";
  } else if (
    k === "sin registrar" ||
    k === "no asistió" ||
    k === "no asistio"
  ) {
    extra = "status-pill--danger";
  }

  return (
    <span className={`status-pill ${extra}`}>
      {text || kind}
    </span>
  );
}
