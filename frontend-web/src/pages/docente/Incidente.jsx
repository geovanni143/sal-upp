import { useNavigate } from "react-router-dom";
import "./docente.css";

export default function Incidente() {
  const nav = useNavigate();

  return (
    <div className="page-shell">
      <div className="menu-card">
        <button className="back-btn" onClick={() => nav(-1)}>←</button>

        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Fecha</div>
        </div>

        <h2 className="center-title">Crear Incidente</h2>

        <div className="form">
          <input type="text" placeholder="Categoría" />
          <input type="text" placeholder="Laboratorio" />
          <textarea placeholder="Descripción"></textarea>

          <div className="photo-upload">
            📷 <span>Añadir foto (opcional)</span>
          </div>

          <button className="btn-primary">Guardar</button>
        </div>
      </div>
    </div>
  );
}
