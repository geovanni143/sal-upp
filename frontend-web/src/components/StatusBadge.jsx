// src/components/StatusBadge.jsx
import "./status-badge.css";

export default function StatusBadge({ kind, text }) {
  if (!kind) {
    return <span className="status-pill status-pill--default">{text || "—"}</span>;
  }

  // Normalizar el estado
  let k = String(kind).toLowerCase().trim();

  // Convertir guiones a espacios para compatibilidad
  k = k.replace(/_/g, " ");

  let extra = "status-pill--default";

  // ============================
  // ESTADOS EN CURSO / PENDIENTES
  // ============================
  if (k.includes("en curso") || k.includes("pendiente")) {
    extra = "status-pill--pending";
  }

  // ============================
  // PRÓXIMA CLASE
  // ============================
  else if (k.includes("proxima") || k.includes("próxima")) {
    extra = "status-pill--upcoming";
  }

  // ============================
  // REGISTRADA / OK
  // ============================
  else if (
    k.includes("registrado") ||
    k.includes("registrada") ||
    k.includes("ok")
  ) {
    extra = "status-pill--ok";
  }

  // ============================
  // ADVERTENCIAS
  // ============================
  else if (
    k.includes("fuera de horario") ||
    k.includes("tarde") ||
    k.includes("tardío") ||
    k.includes("tardio")
  ) {
    extra = "status-pill--warn";
  }

  // ============================
  // ESTADOS NEGATIVOS
  // ============================
  else if (
    k.includes("sin registrar") ||
    k.includes("no asistio") ||
    k.includes("no asistió")
  ) {
    extra = "status-pill--danger";
  }

  // ============================

  return (
    <span className={`status-pill ${extra}`}>
      {text || kind}
    </span>
  );
}
