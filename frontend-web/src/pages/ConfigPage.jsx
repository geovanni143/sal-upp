import { useNavigate } from "react-router-dom";
import "./menu.css";

export default function ConfigPage() {
  const nav = useNavigate();

  const goParams = () => {
    nav("/admin/parametros");
  };

  const goQR = () => {
    nav("/admin/generar-qr");  // 👈 YA REDIRIGE A LA PÁGINA CORRECTA
  };

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 520 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Configuración</h1>
        </div>

        <div className="vertical-actions">
          <button className="big-action" onClick={goParams}>
            Par&aacute;metros del Sistema
          </button>

          <button className="big-action" onClick={goQR}>
            Generar QR/Código
          </button>
        </div>

      </div>
    </div>
  );
}
