// src/pages/MenuAdmin.jsx
// =======================================================
// SAL-UPP — Panel Admin (Revisión de Asistencias)
// LÓGICA CLARA:
// 1) Badge: estado de clase (en_curso / proxima / impartida)
// 2) Banner global: estado del PERIODO (inicia en X días / termina DD MMM)
// 3) Pill: registro (registrada / sin_registro)
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

/* =========================
   Helpers fechas / formato
   ========================= */
const norm = (s) => String(s ?? "").trim();
const hhmm = (s) => String(s || "").slice(0, 5);
const pad2 = (n) => String(n).padStart(2, "0");

function parseDateOnly(v) {
  // acepta "YYYY-MM-DD" o "YYYY-MM-DD HH:mm:ss"
  const s = norm(v);
  if (!s) return null;
  const iso = s.length >= 10 ? s.slice(0, 10) : s;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(a, b) {
  // días enteros entre fechas (b - a)
  const MS = 24 * 60 * 60 * 1000;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / MS);
}

function formatDDMMM(d) {
  try {
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  } catch {
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  }
}

function today0() {
  const h = new Date();
  return new Date(
    `${h.getFullYear()}-${pad2(h.getMonth() + 1)}-${pad2(h.getDate())}T00:00:00`
  );
}

/* =========================
   Periodos (GLOBAL)
   ========================= */

// Toma un objeto "periodo" y devuelve { ini, fin } con muchos nombres posibles
function normalizePeriodoDates(p) {
  const ini =
    parseDateOnly(p.inicio) ||
    parseDateOnly(p.fecha_inicio) ||
    parseDateOnly(p.inicio_periodo) ||
    parseDateOnly(p.periodo_ini);

  const fin =
    parseDateOnly(p.fin) ||
    parseDateOnly(p.fecha_fin) ||
    parseDateOnly(p.fin_periodo) ||
    parseDateOnly(p.periodo_fin);

  return { ini, fin };
}

function buildPeriodoBanner(periodosRaw) {
  const periodos = Array.isArray(periodosRaw) ? periodosRaw : [];
  if (periodos.length === 0) return null;

  // normaliza y filtra los que sí tengan fechas
  const list = periodos
    .map((p) => {
      const { ini, fin } = normalizePeriodoDates(p);
      return { ...p, _ini: ini, _fin: fin };
    })
    .filter((p) => p._ini && p._fin)
    .sort((a, b) => a._ini - b._ini);

  if (list.length === 0) return null;

  const hoy = today0();

  // Periodo actual (hoy dentro)
  const actual = list.find((p) => hoy >= p._ini && hoy <= p._fin);
  if (actual) {
    return {
      kind: "en_curso",
      text: `Periodo en curso — Termina ${formatDDMMM(actual._fin)}`,
    };
  }

  // Próximo periodo (el más cercano en el futuro)
  const proximo = list.find((p) => hoy < p._ini);
  if (proximo) {
    const dias = diffDays(hoy, proximo._ini);
    const when = dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`;
    return {
      kind: "proximo",
      text: `Periodo aún no comienza — Inicia ${when} (${formatDDMMM(
        proximo._ini
      )})`,
    };
  }

  // Si no hay próximo y tampoco actual, entonces todos ya terminaron
  const ultimo = list[list.length - 1];
  return {
    kind: "antiguo",
    text: `No hay un periodo vigente — Último periodo terminó ${formatDDMMM(
      ultimo._fin
    )}`,
  };
}

/* =========================
   Normalización de clase/registro
   ========================= */

function normalizeRegistro(it) {
  const raw = norm(it.registro_codigo).toLowerCase();
  const detalle = norm(it.registro_detalle);

  let codigo;

  switch (raw) {
    case "registrado":
    case "registrada":
    case "ok":
      codigo = "registrada";
      break;

    case "tardio":
      codigo = "tardio";
      break;

    case "registro_invitado":
      codigo = "registro_invitado";
      break;

    case "no_asistio":
      codigo = "no_asistio";
      break;

    case "sin_registrar":
    case "sin_registro":
    case "pendiente":
    case "no":
    default:
      codigo = "sin_registro";
      break;
  }

  const label =
    norm(it.registro) ||
    (codigo === "registrada"
      ? "Registrada"
      : codigo === "tardio"
      ? "Registro tardío"
      : codigo === "registro_invitado"
      ? "Registro invitado"
      : codigo === "no_asistio"
      ? "No asistió"
      : "Sin registrar");

  return { codigo, label, detalle };
}


function normalizeEstado(it) {
  const raw = norm(it.estado_codigo).toLowerCase();

  const estadoCodigo =
    raw === "en_curso" || raw === "encurso"
      ? "en_curso"
      : raw === "proxima" || raw === "proximo"
      ? "proxima"
      : "impartida";

  const estadoLabel =
    norm(it.estado) ||
    (estadoCodigo === "en_curso"
      ? "En curso"
      : estadoCodigo === "proxima"
      ? "Próxima"
      : "Impartida");

  const textoEstado =
    norm(it.texto_estado) ||
    (estadoCodigo === "en_curso"
      ? "Clase en curso"
      : estadoCodigo === "proxima"
      ? "Clase próxima"
      : "Clase ya impartida");

  const diaLabel = norm(it.dia) || (it.dia_num ? DIA_LABEL[it.dia_num] : "");
  const horaIni = hhmm(it.hora_ini);
  const horaFin = hhmm(it.hora_fin);

  return { estadoCodigo, estadoLabel, textoEstado, diaLabel, horaIni, horaFin };
}

function buildRegistroResumen(reg) {
  return reg.label + (reg.detalle ? ` — ${reg.detalle}` : "");
}

export default function MenuAdmin() {
  const nav = useNavigate();

  const [diaSel, setDiaSel] = useState("hoy");
  const [labSel, setLabSel] = useState("todos");
  const [docFiltro, setDocFiltro] = useState("");
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState(null);
  const [labs, setLabs] = useState([]);

  // ✅ NUEVO: periodos + banner global
  const [periodos, setPeriodos] = useState([]);
  const periodoBanner = useMemo(() => buildPeriodoBanner(periodos), [periodos]);

  const diaOptions = useMemo(() => buildDiaOptions(), []);

  // ---------------- Cargar labs ----------------
  useEffect(() => {
    (async () => {
      try {
        const labsRes = await api.get("/labs");
        const labsData = Array.isArray(labsRes.data)
          ? labsRes.data
          : labsRes.data.items || [];

        // ✅ Normaliza y evita keys repetidas en <option>
        // (si vienen ids null/repetidos del backend)
        const normalized = labsData
          .map((l, idx) => ({
            ...l,
            _key: `${l.id ?? "x"}-${l.nombre ?? "lab"}-${idx}`, // key segura
          }))
          .filter((l) => l && (l.nombre || "").trim().length > 0);

        // (opcional) inspección rápida en consola
        // console.table(normalized.map(x => ({ id: x.id, nombre: x.nombre, key: x._key })));

        setLabs(normalized);
      } catch (err) {
        console.error("Error cargando labs:", err);
        setLabs([]);
      }
    })();
  }, []);

  // ---------------- ✅ Cargar periodos (GLOBAL) ----------------
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/periodos");
        const data = Array.isArray(res.data) ? res.data : res.data.items || [];
        setPeriodos(data);
      } catch (err) {
        console.error("Error cargando periodos:", err);
        setPeriodos([]);
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

  // ---------------- Filtros + Orden en front ----------------
  const itemsFiltrados = useMemo(() => {
    if (!Array.isArray(items)) return [];

    let out = [...items];

    if (labSel !== "todos")
      out = out.filter((x) => Number(x.lab_id) === Number(labSel));

    const busq = docFiltro.trim().toLowerCase();
    if (busq)
      out = out.filter((x) =>
        (x.docente || "").toLowerCase().includes(busq)
      );

    const tipoOrden = { en_curso: 1, proxima: 2, impartida: 3 };

    out.sort((a, b) => {
      const ta = tipoOrden[norm(a.estado_codigo).toLowerCase()] || 99;
      const tb = tipoOrden[norm(b.estado_codigo).toLowerCase()] || 99;
      if (ta !== tb) return ta - tb;

      if ((a.dia_num || 0) !== (b.dia_num || 0))
        return (a.dia_num || 0) - (b.dia_num || 0);
      return String(a.hora_ini || "").localeCompare(String(b.hora_ini || ""));
    });

    return out;
  }, [items, labSel, docFiltro]);

  // ---------------- Logout ----------------
  const logout = () => {
    clearSession();
    nav("/login-admin", { replace: true });
  };

  const tituloRango =
    diaSel === "semana"
      ? "Mostrando todas las clases de la semana"
      : "Mostrando todas las clases del día seleccionado";

  return (
    <div className="page-shell">
      <div className="menu-card">
        {/* HEADER */}
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Administración</div>
        </div>

        <div className="block">
          <h3>Revisión de Asistencias</h3>

          {/* ✅ BANNER GLOBAL DEL PERIODO */}
          {periodoBanner && (
            <div className={`periodo-banner periodo-${periodoBanner.kind}`}>
              {periodoBanner.text}
            </div>
          )}

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

              {/* ✅ KEY CORREGIDA: usa _key para evitar duplicados */}
              {labs.map((l) => (
                <option key={l._key} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>

            <input
              type="text"
              className="filter-input"
              placeholder="Buscar docente…"
              value={docFiltro}
              onChange={(e) => setDocFiltro(e.target.value)}
            />

            <button
              className="btn btn-refresh"
              onClick={cargarClases}
              disabled={loading}
              type="button"
            >
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>

          <div className="filters-hint">{tituloRango}</div>

          <div className="class-list">
            {items === null && <div className="empty">Cargando…</div>}

            {items !== null && itemsFiltrados.length === 0 && (
              <div className="empty">
                No hay clases para los filtros seleccionados.
              </div>
            )}

            {itemsFiltrados.map((it) => {
              const est = normalizeEstado(it);
              const reg = normalizeRegistro(it);

              return (
                <div
                  className="class-card"
                  key={`${it.id || 0}-${it.dia_num || 0}-${it.hora_ini || "00:00"}-${
                    it.lab_id || 0
                  }`}
                >
                  <div className="class-row">
                    <div className="class-title">
                      {it.lab} — {it.materia}
                    </div>

                    {/* Badge SOLO estado CLASE */}
                    <StatusBadge kind={est.estadoCodigo} text={est.estadoLabel} />
                  </div>

                  <div className="class-sub">
                    <strong>{est.horaIni}</strong> — <strong>{est.horaFin}</strong>
                  </div>

                  <div className="class-meta-row">
                    <span className="class-meta-estado">{est.textoEstado}</span>
                    <span className="class-meta-dia">{est.diaLabel}</span>
                  </div>

                  {it.docente && <div className="docente-tag">{it.docente}</div>}

                  {/* Registro SOLO registro */}
                  <div className={`registro-pill registro-${reg.codigo}`}>
                    {buildRegistroResumen(reg)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ACCIONES */}
        <button className="big-action" onClick={() => nav("/admin/gestionar")}>
          Gestionar
        </button>

        <div className="grid-2">
          <button className="btn-secondary" onClick={() => nav("/admin/incidentes")}>
            Incidentes
          </button>
          <button className="btn-secondary" onClick={() => nav("/admin/historial")}>
            Historial
          </button>
        </div>

        <div className="grid-2">
          <button className="btn-secondary-ghost" onClick={() => nav("/admin/config")}>
            Configurar
          </button>

          <button className="btn-secondary-ghost" onClick={() => nav("/admin/perfil")}>
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
