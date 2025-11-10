// src/pages/MenuAdmin.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "./menu.css";
import { clearSession } from "../state/auth";

export default function MenuAdmin() {
  const nav = useNavigate();
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/asistencias-hoy");
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]); // sin datos/mocks
      }
    })();
  }, []);

  const logout = () => {
    clearSession();
    nav("/login-admin", { replace: true });
  };

  return (
    <div className="page-shell">
      <div className="menu-card" style={{ maxWidth: 520 }}>
        {/* Encabezado */}
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Administración</div>
        </div>

        {/* Lista: Asistencias hoy */}
        <div className="block" style={{ marginTop: 8 }}>
          <h3>Revisión de Asistencias hoy</h3>

          {items === null && <div className="empty">Cargando…</div>}
          {items?.length === 0 && items !== null && (
            <div className="empty">Sin registros hoy.</div>
          )}

          {items?.map((it) => (
            <div className="class-card" key={it.id}>
              <div className="class-row">
                <div className="class-title">
                  {it.lab} {it.materia}
                </div>
                <StatusBadge kind={it.estado} text={it.estado} />
              </div>
              <div className="class-row">
                <div className="class-sub">
                  {it.dia} {it.hora}
                </div>
                {it.extra && (
                  <button
                    className="btn-pill"
                    onClick={() =>
                      nav("/admin/historial", { state: { motivo: it.extra, from: "asistencias-hoy" } })
                    }
                  >
                    Ver Motivo…
                  </button>
                )}
              </div>
              {it.docente && (
                <div style={{ fontSize: 12, color: "#667" }}>{it.docente}</div>
              )}
            </div>
          ))}
        </div>

        {/* Acción principal (rutas correctas) */}
        <button className="big-action" onClick={() => nav("/admin/gestionar")}>
          Gestionar
        </button>

        {/* Accesos rápidos (rutas correctas) */}
        <div className="grid-2" style={{ marginTop: 12 }}>
          <button
            className="btn-secondary"
            onClick={() => nav("/admin/incidentes")}
          >
            Incidentes
          </button>
          <button
            className="btn-secondary"
            onClick={() => nav("/admin/historial")}
          >
            Historial
          </button>
        </div>

        <div className="grid-2" style={{ marginTop: 12 }}>
          <button
            className="btn-secondary-ghost"
            onClick={() => nav("/admin/config")}
          >
            Configurar
          </button>
          <button
            className="btn-secondary-ghost"
            onClick={() => nav("/admin/perfil")}
          >
            Perfil
          </button>
        </div>

        <button className="logout" onClick={logout} style={{ marginTop: 16 }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
