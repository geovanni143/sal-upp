import { useNavigate } from "react-router-dom";
import "./menu.css";

export default function ConfigPage() {
  const nav = useNavigate();

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 520 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>
            ← Regresar
          </button>
          <h1>Configuración</h1>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 14,
          }}
        >
          <button className="big-action" onClick={() => nav("/admin/parametros")}>
            Parámetros del Sistema
          </button>

          <button className="big-action" onClick={() => nav("/admin/generar-qr")}>
            Generar QR/Código
          </button>
        </div>
      </div>
    </div>
  );
}
