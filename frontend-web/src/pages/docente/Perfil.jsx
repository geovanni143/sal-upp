import { useNavigate } from "react-router-dom";
import "./docente.css";

export default function Perfil() {
  const nav = useNavigate();

  return (
    <div className="page-shell">
      <div className="menu-card">
        <button className="back-btn" onClick={() => nav(-1)}>←</button>

        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Docente</div>
        </div>

        <h2 className="center-title">Perfil Docente</h2>

        <div className="avatar"></div>

        <div className="profile-info">
          <h3>Geovanni Hernandez Hernandez</h3>
          <p>geovanni@micorre.upp.mx</p>
          <p>2331123683</p>
          <p>Contraseña</p>
        </div>

        <button className="btn-primary">Cambiar datos</button>
      </div>
    </div>
  );
}
