// src/pages/MenuAdmin.jsx
// =======================================================
// SAL-UPP — Panel Admin (Revisión de Asistencias)
// =======================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "./menu.css";
import { clearSession } from "../state/auth";

/* Día para combo */
const DIA_LABEL = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

function getTodayDiaNumero() {
  const dow = new Date().getDay();
  return dow >= 1 && dow <= 5 ? dow : 1;
}

function buildDiaOptions() {
  const today = getTodayDiaNumero();
  return [
    { id: "hoy", label: `Hoy (${DIA_LABEL[today]})` },
    { id: 1, label: "Lunes" },
    { id: 2, label: "Martes" },
    { id: 3, label: "Miércoles" },
    { id: 4, label: "Jueves" },
    { id: 5, label: "Viernes" },
    { id: "semana", label: "Todos los días (Semana)" },
  ];
}

export default function MenuAdmin() {
  const nav = useNavigate();

  const [diaSel, setDiaSel] = useState("hoy");
  const [labSel, setLabSel] = useState("todos");
  const [docFiltro, setDocFiltro] = useState("");
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState(null);
  const [labs, setLabs] = useState([]);
  const [docs, setDocs] = useState([]);

  const diaOptions = useMemo(() => buildDiaOptions(), []);

  // ---------------- Cargar labs + docentes ----------------
  useEffect(() => {
    (async () => {
      try {
        const [labsRes, docsRes] = await Promise.all([
          api.get("/labs"),
          api.get("/users?roles=docente,admin,superadmin"),
        ]);

        const labsData = Array.isArray(labsRes.data)
          ? labsRes.data
          : labsRes.data.items || [];

        const docsData = Array.isArray(docsRes.data)
          ? docsRes.data
          : docsRes.data.items || [];

        setLabs(labsData);
        setDocs(docsData);
      } catch (err) {
        console.error("Error cargando filtros:", err);
        setLabs([]);
        setDocs([]);
      }
    })();
  }, []);

  // ---------------- Cargar clases desde backend ----------------
  const cargarClases = async () => {
    try {
      setLoading(true);
      const params = { dia: diaSel };
      if (labSel !== "todos") params.lab_id = labSel;

      const { data } = await api.get("/admin/asistencias-dia", { params });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando asistencias:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarClases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaSel, labSel]);

  // ---------------- Filtros en front ----------------
  const itemsFiltrados = useMemo(() => {
    if (!Array.isArray(items)) return [];

    let out = [...items];

    if (labSel !== "todos") {
      out = out.filter((x) => Number(x.lab_id) === Number(labSel));
    }

    const busq = docFiltro.trim().toLowerCase();
    if (busq) {
      out = out.filter((x) => (x.docente || "").toLowerCase().includes(busq));
    }

    // Orden: en curso → próxima → impartida; luego por día y hora
    const tipoOrden = { en_curso: 1, proxima: 2, impartida: 3 };

    out.sort((a, b) => {
      const ta = tipoOrden[a.estado_codigo] || 99;
      const tb = tipoOrden[b.estado_codigo] || 99;
      if (ta !== tb) return ta - tb;

      // por día (1..5) y luego por hora_ini
      if (a.dia_num !== b.dia_num) return a.dia_num - b.dia_num;
      return String(a.hora_ini).localeCompare(String(b.hora_ini));
    });

    return out;
  }, [items, labSel, docFiltro]);

  // ---------------- Logout ----------------
  const logout = () => {
    clearSession();
    nav("/login-admin", { replace: true });
  };

  // Texto resumen
  const tituloRango =
    diaSel === "semana"
      ? "Mostrando todas las clases de la semana"
      : "Mostrando todas las clases del día seleccionado";

  // ---------------- Render ----------------
  return (
    <div className="page-shell">
      <div className="menu-card">
        {/* HEADER */}
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Administración</div>
        </div>

        {/* BLOQUE PRINCIPAL */}
        <div className="block">
          <h3>Revisión de Asistencias</h3>

          {/* FILTROS */}
          <div className="filters-row">
            <select
              value={diaSel}
              onChange={(e) => setDiaSel(e.target.value)}
              className="filter-input"
            >
              {diaOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>

            <select
              value={labSel}
              onChange={(e) => setLabSel(e.target.value)}
              className="filter-input"
            >
              <option value="todos">Todos los laboratorios</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="filters-row">
            <input
              type="text"
              className="filter-input"
              placeholder="Buscar docente…"
              value={docFiltro}
              onChange={(e) => setDocFiltro(e.target.value)}
            />
            <button
              className="filter-refresh"
              onClick={cargarClases}
              disabled={loading}
            >
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>

          <div className="filters-hint">{tituloRango}</div>

          {/* LISTA (con scroll interno) */}
          <div className="class-list">
            {items === null && <div className="empty">Cargando…</div>}

            {items !== null && itemsFiltrados.length === 0 && (
              <div className="empty">
                No hay clases para los filtros seleccionados.
              </div>
            )}

            {itemsFiltrados.map((it) => (
              <div
                className="class-card"
                key={`${it.id || 0}-${it.dia_num || 0}-${it.hora_ini || "00:00"}`}
              >
                <div className="class-row">
                  <div className="class-title">
                    {it.lab} — {it.materia}
                  </div>
                  <StatusBadge kind={it.estado_codigo} text={it.estado} />
                </div>

                <div className="class-sub">
                  {it.hora_ini} — {it.hora_fin}
                </div>

                <div className="class-meta-row">
                  <span className="class-meta-estado">{it.texto_estado}</span>
                  <span className="class-meta-dia">{it.dia}</span>
                </div>

                {it.docente && (
                  <div className="docente-tag">{it.docente}</div>
                )}

                {/* Estado de registro */}
                <div
                  className={`registro-tag registro-${it.registro_codigo}`}
                >
                  <span className="registro-main">{it.registro}</span>
                  {it.registro_detalle && (
                    <span className="registro-detalle">
                      {" — "}
                      {it.registro_detalle}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ACCIONES */}
        <button
          className="big-action"
          onClick={() => nav("/admin/gestionar")}
        >
          Gestionar
        </button>

        <div className="grid-2">
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

        <div className="grid-2">
          <button
            className="btn-secondary-ghost"
            onClick={() => nav("/admin/config")}
          >
            Configurar
          </button>
          {/* AQUÍ EL CAMBIO: ahora va a /admin/perfil, que usa PerfilPage */}
          <button
            className="btn-secondary-ghost"
            onClick={() => nav("/admin/perfil")}
          >
            Perfil
          </button>
        </div>

        <button className="logout" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
