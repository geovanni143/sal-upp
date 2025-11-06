import { useNavigate } from "react-router-dom";
import "./menu.css";

export default function ConfigPage() {
  const nav = useNavigate();

  // Solo UI. Cuando tengas backend, aquí pegas los fetch/submit.
  const goQR = () => alert("Generar QR/Código (pendiente backend)");
  const goParams = () => alert("Parámetros del sistema (pendiente backend)");

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 520 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Configuración</h1>
        </div>

        <div className="vertical-actions">
          <button className="big-action" onClick={goParams}>Parámetros del Sistema</button>
          <button className="big-action" onClick={goQR}>Generar QR/Código</button>
        </div>

        <div className="help-foot">A-93 Programación visual</div>
      </div>
    </div>
  );
}
