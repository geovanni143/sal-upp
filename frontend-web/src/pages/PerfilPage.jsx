import { useNavigate } from "react-router-dom";
import "./menu.css";

export default function PerfilPage() {
  const nav = useNavigate();

  // Mock de datos de sesión. Cambiar por store real:
  const user = {
    nombre: "Geovanni Hernandez Hernandez",
    email: "geovanni@micorre.upp.mx",
    telefono: "2331123683",
  };

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 520 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <div>
            <div className="brand">SAL-UPP</div>
            <div className="menu-sub">Administrador</div>
          </div>
        </div>

        <div className="profile-box">
          <div className="avatar" />
          <h3 className="profile-name">{user.nombre}</h3>
          <div className="profile-line">{user.email}</div>
          <div className="profile-line">{user.telefono}</div>

          <h4 className="profile-section">Contraseña</h4>
          <div className="grid-2" style={{ marginTop: 8 }}>
            <button className="btn-save" onClick={() => alert("Cambiar datos (pendiente backend)")}>Cambiar datos</button>
        
          </div>

          <div className="profile-check">
        
          </div>
        </div>
      </div>
    </div>
  );
}
