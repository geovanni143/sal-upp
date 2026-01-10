// src/components/StatusBadge.jsx
import "./status-badge.css";

export default function StatusBadge({ kind, text }) {
  const rawKind = String(kind ?? "").trim();
  const rawText = String(text ?? "").trim();

  // Si no hay nada, placeholder
  if (!rawKind && !rawText) {
    return <span className="status-pill status-pill--default">—</span>;
  }

  // Normalización robusta
  const k = rawKind
    .toLowerCase()
    .replace(/_/g, " ")          // en_curso -> en curso
    .replace(/\s+/g, " ")        // espacios dobles
    .trim();

  // ============================
  // SOLO ESTADO DE CLASE
  // ============================
  // En curso
  const isEnCurso =
    k === "en curso" ||
    k.includes("en curso") ||
    k.includes("pendiente") ||
    k.includes("curso");

  // Próxima
  const isProxima =
    k === "proxima" ||
    k === "próxima" ||
    k.includes("proxima") ||
    k.includes("próxima") ||
    k.includes("proxima esta semana") ||
    k.includes("próxima esta semana");

  // Impartida (ya pasó)
  const isImpartida =
    k === "impartida" ||
    k.includes("impartida") ||
    k.includes("ya impartida") ||
    k.includes("finalizada") ||
    k.includes("terminada");

  let extra = "status-pill--default";

  if (isEnCurso) extra = "status-pill--pending";
  else if (isProxima) extra = "status-pill--upcoming";
  else if (isImpartida) extra = "status-pill--default";
  else extra = "status-pill--default";

  // Texto visible: prioriza `text`, si no existe, lo mapeamos a algo legible
  const visible =
    rawText ||
    (isEnCurso ? "En curso" : isProxima ? "Próxima" : isImpartida ? "Impartida" : rawKind);

  return <span className={`status-pill ${extra}`}>{visible}</span>;
}
