export default function StatusBadge({ kind = "pendiente", text }) {
  const map = {
    registrada: "ok",
    pendiente: "warn",
    "fuera de horario": "danger",
    "no asistio": "danger",
    retardo: "purple",
    "sin registrar": "rose",
  };
  const k = map[kind?.toLowerCase?.()] || "warn";
  return <span className={`badge badge--${k}`}>{text || kind}</span>;
}
