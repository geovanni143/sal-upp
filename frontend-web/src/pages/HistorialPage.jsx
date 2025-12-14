import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFiltrosHistorial,
  getDocentesHistorial,
  getHistorial,
} from "../services/historialApi";
import "./menu.css";

/* ===========================
   Estados visuales
   =========================== */
const ESTADO_CLASS = {
  REGISTRADA: "tag-green",
  FUERA_DE_HORARIO: "tag-red",
  NO_ASISTIO: "tag-orange",
  INVITADO: "tag-blue",
};

const ESTADO_LABEL = {
  REGISTRADA: "Registrada",
  FUERA_DE_HORARIO: "Fuera de horario",
  NO_ASISTIO: "No asistió",
  INVITADO: "Registro de invitado",
};

/* ===========================
   Helpers fechas
   =========================== */
const toISO = (d) => d.toISOString().slice(0, 10);

function getMonday() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

function getFriday() {
  const d = getMonday();
  d.setDate(d.getDate() + 4);
  return d;
}

export default function HistorialPage() {
  const nav = useNavigate();

  const [periodos, setPeriodos] = useState([]);
  const [labs, setLabs] = useState([]);
  const [docentes, setDocentes] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostrar, setMostrar] = useState(false);

  const [f, setF] = useState({
    periodoId: "",
    labId: "",
    docenteId: "",
    estado: "",
    del: "",
    al: "",
  });

  /* ===========================
     Carga inicial filtros
     =========================== */
  useEffect(() => {
    (async () => {
      try {
        const data = await getFiltrosHistorial();
        setPeriodos(data.periodos || []);
        setLabs(data.labs || []);

        if (!data.periodos?.length) return;

        const periodo = data.periodos[0];

        const ini = new Date(periodo.fecha_ini);
        const fin = new Date(periodo.fecha_fin);

        let del = getMonday();
        let al = getFriday();

        if (del < ini) del = ini;
        if (al > fin) al = fin;
        if (al < del) al = del;

        const filtrosIniciales = {
          periodoId: periodo.id,
          labId: "",
          docenteId: "",
          estado: "",
          del: toISO(del),
          al: toISO(al),
        };

        setF(filtrosIniciales);

        // Docentes para el periodo completo (todos los labs)
        const docs = await getDocentesHistorial({
          periodoId: periodo.id,
          labId: "",
        });
        setDocentes(docs);
      } catch (err) {
        console.error(err);
        alert("No se pudieron cargar los filtros de historial.");
      }
    })();
  }, []);

  /* ===========================
     Cambio de periodo
     =========================== */
  const handlePeriodoChange = async (e) => {
    const nuevoId = e.target.value;
    if (!nuevoId) return;

    if (f.periodoId && nuevoId !== String(f.periodoId)) {
      const ok = window.confirm(
        "Vas a consultar registros de otro periodo. ¿Deseas continuar?"
      );
      if (!ok) return;
    }

    const periodo = periodos.find((p) => String(p.id) === String(nuevoId));
    if (!periodo) return;

    const ini = new Date(periodo.fecha_ini);
    const fin = new Date(periodo.fecha_fin);

    let del = getMonday();
    let al = getFriday();
    if (del < ini) del = ini;
    if (al > fin) al = fin;
    if (al < del) al = del;

    const nuevosFiltros = {
      periodoId: periodo.id,
      labId: "",
      docenteId: "",
      estado: "",
      del: toISO(del),
      al: toISO(al),
    };

    setF(nuevosFiltros);
    setRows([]);
    setMostrar(false);

    const docs = await getDocentesHistorial({
      periodoId: periodo.id,
      labId: "",
    });
    setDocentes(docs);
  };

  /* ===========================
     Cambio de laboratorio
     =========================== */
  const handleLabChange = async (e) => {
    const labId = e.target.value;

    const nuevosFiltros = {
      ...f,
      labId,
      docenteId: "",
    };
    setF(nuevosFiltros);

    if (!f.periodoId) return;

    const docs = await getDocentesHistorial({
      periodoId: f.periodoId,
      labId,
    });
    setDocentes(docs);
  };

  /* ===========================
     Cambio simple de filtro
     =========================== */
  const handleChange = (field, value) => {
    setF((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* ===========================
     Botón Mostrar
     =========================== */
  const handleMostrar = async () => {
    if (!f.periodoId || !f.del || !f.al) {
      alert("Periodo y rango de fechas son obligatorios.");
      return;
    }

    try {
      setLoading(true);
      const data = await getHistorial(f);
      setRows(data || []);
      setMostrar(true);
    } catch (err) {
      console.error(err);
      alert("No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  };

  const list = useMemo(() => (mostrar ? rows : []), [rows, mostrar]);

  /* ===========================
     Render
     =========================== */
  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 720 }}>
        {/* HEADER */}
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>
            ← Regresar
          </button>
          <h1>Historial</h1>
          <div style={{ flex: 1 }} />
          <button
            className="btn-back"
            onClick={handleMostrar}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Mostrar"}
          </button>
          <button
            className="btn-save"
            onClick={() => alert("Generar PDF (pendiente)")}
          >
            Generar PDF
          </button>
        </div>

        {/* FILTROS – diseño tipo “pastilla” vertical */}
        <div className="filters-vertical">
          <label>Período</label>
          <select
            className="input"
            value={f.periodoId}
            onChange={handlePeriodoChange}
          >
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <label>Laboratorio</label>
          <select
            className="input"
            value={f.labId}
            onChange={handleLabChange}
          >
            <option value="">Todos</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>

          <label>Docente</label>
          <select
            className="input"
            value={f.docenteId}
            onChange={(e) => handleChange("docenteId", e.target.value)}
          >
            <option value="">Todos</option>
            {docentes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>

          <label>Estado</label>
          <select
            className="input"
            value={f.estado}
            onChange={(e) => handleChange("estado", e.target.value)}
          >
            <option value="">Todos</option>
            {Object.keys(ESTADO_LABEL).map((k) => (
              <option key={k} value={k}>
                {ESTADO_LABEL[k]}
              </option>
            ))}
          </select>

          <label>Desde</label>
          <input
            className="input"
            type="date"
            value={f.del}
            onChange={(e) => handleChange("del", e.target.value)}
          />

          <label>Hasta</label>
          <input
            className="input"
            type="date"
            value={f.al}
            onChange={(e) => handleChange("al", e.target.value)}
          />
        </div>

        {/* LISTADO */}
        <div className="list-container">
          {!mostrar && (
            <div className="empty">
              Selecciona filtros y presiona <b>Mostrar</b>.
            </div>
          )}

          {mostrar && list.length === 0 && (
            <div className="empty">Sin resultados…</div>
          )}

          {list.map((r) => (
            <div key={r.id} className="list-item">
              <div className="item-info">
                <h4>
                  {r.lab} — {r.docente}
                </h4>
                <p>
                  <b>{r.fecha}</b>{" "}
                  {r.hora_ini && r.hora_fin
                    ? `${r.hora_ini.slice(0, 5)} - ${r.hora_fin.slice(0, 5)}`
                    : ""}
                </p>
              </div>
              <span className={`tag ${ESTADO_CLASS[r.estado] || ""}`}>
                {ESTADO_LABEL[r.estado] || r.estado}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
