import { useNavigate } from "react-router-dom";
import "./docente.css";

export default function Historial() {
  const nav = useNavigate();

  return (
    <div className="page-shell">
      <div className="menu-card">
        <button className="back-btn" onClick={() => nav(-1)}>←</button>

        <h2 className="center-title">Historial</h2>

        <div className="form">
          <input type="text" placeholder="Laboratorio" />
          <input type="text" placeholder="Rango de Fechas" />

          <button className="btn-primary small">Generar PDF</button>
        </div>

        <div className="class-list">
          <div className="class-item success">
            <p><b>A-93 Programación visual</b><br />viernes 10:00 - 12:00</p>
            <span>Registrada</span>
          </div>

          <div className="class-item success">
            <p><b>L-Antenas Tutoría</b><br />viernes 7:00 - 8:00</p>
            <span>Registrada</span>
          </div>

          <div className="class-item danger">
            <p><b>A-93 Estancia 1</b><br />viernes 9:00 - 10:00</p>
            <span>Fuera de horario</span>
          </div>

          <div className="class-item warning">
            <p><b>A-93 Estancia 1</b><br />viernes 9:00 - 10:00</p>
            <span>No asistió</span>
          </div>
        </div>
      </div>
    </div>
  );
}
