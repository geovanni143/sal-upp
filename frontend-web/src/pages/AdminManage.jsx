// src/pages/AdminManage.jsx
import { useNavigate, Link } from "react-router-dom";
import "./menu.css";

export default function AdminManage(){
  const nav = useNavigate();

  return (
    <div className="page-shell">
      <div className="menu-card manage-narrow">
        <header className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Gestionar</div>
        </header>

        <div className="manage-list">
          <button className="manage-item" onClick={()=>nav("/admin/users")}>
            Usuarios
          </button>
          <button className="manage-item" onClick={()=>nav("/admin/labs")}>
            Laboratorios
          </button>
          <button className="manage-item" onClick={()=>nav("/admin/periodos")}>
            Periodos
          </button>
          <button className="manage-item" onClick={()=>nav("/admin/horarios")}>
            Horarios
          </button>
        </div>

        <div className="manage-footer">
          <Link className="manage-back" to="/admin">Volver al menú</Link>
        </div>
      </div>
    </div>
  );
}
