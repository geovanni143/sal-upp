// src/pages/UsersPage.jsx
import { useState } from "react";
import "./menu.css";

export default function UsersPage() {
  const [filtro, setFiltro] = useState("");

  return (
    <div className="page-shell">
      <div className="menu-card">
        <div className="menu-head">
          <div className="menu-title">Gestión de Usuarios</div>
        </div>

        <div className="block" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            placeholder="Buscar por nombre o correo…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn-secondary" onClick={() => alert("Nuevo (WIP)")}>
            Nuevo
          </button>
        </div>

        <div className="block">
          <p>Vista temporal para Sprint 2. El CRUD real va aquí.</p>
        </div>
      </div>
    </div>
  );
}
