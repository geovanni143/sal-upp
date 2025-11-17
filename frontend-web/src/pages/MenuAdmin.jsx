// src/pages/MenuAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "./menu.css";
import { clearSession } from "../state/auth";

// Helpers locales de día
const DIA_LABEL = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

function getTodayDiaNumero() {
  const dow = new Date().getDay(); // 0=Dom,...6=Sab
  if (dow >= 1 && dow <= 5) return dow;
  return 1;
}

function buildDiaOptions() {
  const today = getTodayDiaNumero();

  const base = [
    { id: "hoy", label: `Hoy (${DIA_LABEL[today]})` },
    { id: 1, label: "Lunes" },
    { id: 2, label: "Martes" },
    { id: 3, label: "Miércoles" },
    { id: 4, label: "Jueves" },
    { id: 5, label: "Viernes" },
    { id: "semana", label: "Todos los días (Semana)" },
  ];

  // Evitar duplicar el día en el que estamos, ej. Hoy (Lunes) + Lunes
  return base.filter((opt) => {
    if (opt.id === "hoy") return true;
    if (typeof opt.id === "number" && opt.id === today) return false;
    return true;
  });
}

export default function MenuAdmin() {
  const nav = useNavigate();

  const [diaSel, setDiaSel] = useState("hoy");
  const [labSel, setLabSel] = useState("todos");
  const [docSel, setDocSel] = useState("todos");

  const [items, setItems] = useState(null); // respuesta de backend
  const [verTodo, setVerTodo] = useState(false); // false -> rango 3 horas

  const [labs, setLabs] = useState([]);
  const [docs, setDocs] = useState([]);

  const diaOptions = useMemo(() => buildDiaOptions(), []);

  // Cargar catálogo de labs y docentes para filtros
  useEffect(() => {
    (async () => {
      try {
        const [labsRes, docsRes] = await Promise.all([
          api.get("/labs"),
          api.get("/users?roles=docente,admin,superadmin"),
        ]);

        const labsArr = Array.isArray(labsRes.data) ? labsRes.data : labsRes.data.items || [];
        const docsArr = Array.isArray(docsRes.data) ? docsRes.data : docsRes.data.items || [];

        setLabs(labsArr);
        setDocs(docsArr);
      } catch (err) {
        console.error("Error cargando filtros (labs/docs):", err);
        setLabs([]);
        setDocs([]);
      }
    })();
  }, []);

  // Cargar asistencias del día seleccionado
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/asistencias-dia", {
          params: { dia: diaSel },
        });
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error cargando asistencias-dia:", err);
        setItems([]);
      }
    })();
  }, [diaSel]);

  const logout = () => {
    clearSession();
    nav("/login-admin", { replace: true });
  };

  // Aplicar filtros (laboratorio / docente / rango 3h vs todo el día)
  const itemsFiltrados = useMemo(() => {
    if (!Array.isArray(items)) return [];

    let out = items;

    if (labSel !== "todos") {
      const labIdNum = Number(labSel);
      out = out.filter((it) => Number(it.lab_id) === labIdNum);
    }

    if (docSel !== "todos") {
      const docIdNum = Number(docSel);
      out = out.filter((it) => Number(it.docente_id || 0) === docIdNum);
    }

    if (!verTodo) {
      // Solo rango de 3 horas: En curso + Próxima
      out = out.filter(
        (it) =>
          String(it.estado).toLowerCase() === "en curso" ||
          String(it.estado).toLowerCase() === "próxima" ||
          String(it.estado).toLowerCase() === "proxima"
      );
    }

    return out;
  }, [items, labSel, docSel, verTodo]);

  const limpiarFiltros = () => {
    setLabSel("todos");
    setDocSel("todos");
  };

  const tituloRango = verTodo
    ? "Mostrando TODAS las clases del día seleccionado"
    : "Mostrando clases en curso y próximas (rango 3 horas)";

  return (
    <div className="page-shell">
      <div className="menu-card" style={{ maxWidth: 520 }}>
        {/* Encabezado */}
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Administración</div>
        </div>

        {/* Bloque de asistencias hoy */}
        <div className="block" style={{ marginTop: 8 }}>
          <h3>Revisión de Asistencias hoy</h3>

          {/* Filtros */}
          <div className="filters-row">
            <select
              className="filter-input"
              value={diaSel}
              onChange={(e) => setDiaSel(e.target.value)}
            >
              {diaOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              className="filter-input"
              value={labSel}
              onChange={(e) => setLabSel(e.target.value)}
            >
              <option value="todos">Todos los laboratorios</option>
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="filters-row" style={{ marginTop: 6 }}>
            <select
              className="filter-input"
              value={docSel}
              onChange={(e) => setDocSel(e.target.value)}
            >
              <option value="todos">Todos los docentes</option>
              {docs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellidos || ""}
                </option>
              ))}
            </select>

            <button className="filter-clear" onClick={limpiarFiltros}>
              Limpiar
            </button>
          </div>

          {/* Botón rango 3h / todo el día */}
          <button
            className="filter-toggle"
            onClick={() => setVerTodo((v) => !v)}
          >
            {verTodo ? "Ver solo rango de 3 horas" : "Ver todo el día"}
          </button>

          <div className="filters-hint">{tituloRango}</div>

          {/* Lista / estados */}
          {items === null && <div className="empty">Cargando…</div>}

          {items !== null && itemsFiltrados.length === 0 && (
            <div className="empty">No hay clases para los filtros seleccionados.</div>
          )}

          {itemsFiltrados.map((it) => (
            <div className="class-card" key={it.id}>
              <div className="class-row">
                <div className="class-title">
                  {it.lab} — {it.materia}
                </div>
                <StatusBadge kind={it.estado} text={it.estado} />
              </div>
              <div className="class-row">
                <div className="class-sub">
                  {it.dia} {it.hora_ini} - {it.hora_fin}
                </div>
              </div>
              {it.docente && (
                <div style={{ fontSize: 12, color: "#667", marginTop: 2 }}>
                  {it.docente}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Acción principal */}
        <button className="big-action" onClick={() => nav("/admin/gestionar")}>
          Gestionar
        </button>

        {/* Accesos rápidos */}
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
