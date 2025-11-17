// src/pages/HorariosPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { periodosApi, labsApi, horariosApi, usersApi } from "../api/http";
import "./menu.css";
import "./horarios-scope.css";

const DIAS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
];

const horasMedias = (() => {
  const out = [];
  const pad = (n) => String(n).padStart(2, "0");
  for (let H = 7; H < 19; H++) {
    out.push(`${pad(H)}:00`);
    out.push(`${pad(H)}:30`);
  }
  return out;
})();

const toMin = (s) => {
  const [H, M] = s.split(":").map(Number);
  return H * 60 + M;
};

function colorFor(key) {
  const palettes = [
    { bg: "#FEF3F2", bd: "#F97373" },
    { bg: "#FFFBEB", bd: "#FACC15" },
    { bg: "#EFF6FF", bd: "#60A5FA" },
    { bg: "#ECFDF3", bd: "#4ADE80" },
    { bg: "#EEF2FF", bd: "#818CF8" },
    { bg: "#FDF2FF", bd: "#F9A8D4" },
  ];
  let h = 0;
  const s = String(key || "x");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return palettes[h % palettes.length];
}

const tituloBloque = (b) =>
  [b.materia, b.codigo].filter(Boolean).join(" — ");

const metaGrupo = (b) =>
  [b.grupo ? `Grupo: ${b.grupo}` : null].filter(Boolean).join(" · ");

// helper para día que venga como 'lu', 'ma', '1', etc.
const normalizarDia = (dia) => {
  const map = { lu: 1, ma: 2, mi: 3, ju: 4, vi: 5 };
  if (typeof dia === "number") return dia;
  if (typeof dia === "string") {
    const s = dia.trim().toLowerCase();
    if (map[s]) return map[s];
    const n = Number(s);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
};

export default function HorariosPage() {
  const nav = useNavigate();
  const wrapRef = useRef(null);

  const [periodos, setPeriodos] = useState([]);
  const [labs, setLabs] = useState([]);
  const [docentes, setDocentes] = useState([]);

  const [periodoId, setPeriodoId] = useState("");
  const [labId, setLabId] = useState("");

  const [plan, setPlan] = useState([]); // bloques

  const [catalogo, setCatalogo] = useState([]);
  const [catSearch, setCatSearch] = useState("");
  const [catShowDeleted, setCatShowDeleted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // clave del horario actualmente en edición (cuando entras con "Ver / editar")
  const [currentKey, setCurrentKey] = useState(null);
  // { periodo_id, lab_id }  ó null si es un horario nuevo

  /* ==========================
     Cargar catálogos base
     ========================== */
  useEffect(() => {
    (async () => {
      try {
        const [p, l, u] = await Promise.all([
          periodosApi.list({ activo: 1 }),
          labsApi.list({ activo: 1 }),
          usersApi.list({ roles: "docente,admin,superadmin" }),
        ]);

        setPeriodos(p.data || []);
        setLabs(l.data || []);

        const norm = (x) => {
          const nombre = [x.nombre, x.apellidos].filter(Boolean).join(" ").trim();
          const user =
            x.email && x.email.includes("@")
              ? x.email.split("@")[0]
              : "";
          return {
            ...x,
            _label: [nombre, user && `@${user}`]
              .filter(Boolean)
              .join(" — "),
          };
        };
        setDocentes((u.data || []).map(norm));
      } catch (e) {
        console.error(e);
        setErr("Error al listar catálogos");
      }
    })();
  }, []);

  /* ==========================
     Catálogo de horarios
     ========================== */
  const cargarCatalogo = async (overrideDeleted) => {
    try {
      const showDeleted =
        typeof overrideDeleted === "boolean"
          ? overrideDeleted
          : catShowDeleted;

      const { data } = await horariosApi.catalogo({
        search: catSearch || undefined,
        mostrar_eliminados: showDeleted ? 1 : 0,
      });

      const raw =
        Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : [];

      const norm = raw.map((it) => ({
        ...it,
        bloques_activos: Number(it.bloques ?? it.bloques_activos ?? 0),
        horario_eliminado: Number(it.horario_eliminado ?? 0),
        activo: Number(it.activo ?? 0),
        en_curso: Boolean(it.en_curso),
      }));

      setCatalogo(norm);
    } catch (e) {
      console.error(e);
      setCatalogo([]);
    }
  };

  useEffect(() => {
    cargarCatalogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const horarioActual = useMemo(
    () =>
      catalogo.find(
        (c) =>
          String(c.periodo_id) === String(periodoId) &&
          String(c.lab_id) === String(labId)
      ) || null,
    [catalogo, periodoId, labId]
  );

  const abrirHorario = async (item) => {
    const pid = String(item.periodo_id);
    const lid = String(item.lab_id);
    setPeriodoId(pid);
    setLabId(lid);
    setCurrentKey({ periodo_id: pid, lab_id: lid }); // <- EDITANDO ESTE HORARIO
    await cargarSemana(pid, lid); // llena la tabla
  };

  const toggleActivo = async (item) => {
    try {
      const fn = item.activo ? horariosApi.desactivar : horariosApi.activar;
      const { data } = await fn({
        periodo_id: item.periodo_id,
        lab_id: item.lab_id,
      });

      if (!data?.ok) {
        alert(data.msg || "No se pudo cambiar el estado del horario");
        return;
      }

      await cargarCatalogo();
    } catch (e) {
      console.error(e);
      alert("Error al cambiar estado del horario");
    }
  };

  // === NUEVA VERSIÓN MEJORADA ===
  const eliminarHorario = async (item) => {
    // no permitir borrar lógicamente un horario en curso
    if (item.en_curso && !catShowDeleted) {
      alert(
        "No puedes eliminar un horario cuyo periodo está en curso. Solo puedes editar sus bloques."
      );
      return;
    }

    const msgConfirm = catShowDeleted
      ? "¿Eliminar PERMANENTEMENTE este horario? (no se podrá recuperar)"
      : "¿Eliminar TODO el horario de este laboratorio en ese período? (se puede restaurar después)";

    if (!confirm(msgConfirm)) return;

    try {
      let data;

      if (catShowDeleted) {
        // eliminación permanente (hard delete)
        ({ data } = await horariosApi.eliminarHard({
          periodo_id: item.periodo_id,
          lab_id: item.lab_id,
        }));
      } else {
        // eliminación lógica (se puede restaurar)
        ({ data } = await horariosApi.eliminar({
          periodo_id: item.periodo_id,
          lab_id: item.lab_id,
        }));
      }

      if (!data?.ok) {
        alert(
          data.msg ||
            (catShowDeleted
              ? "No se pudo eliminar permanentemente el horario"
              : "No se pudo eliminar el horario")
        );
        return;
      }

      // si justo es el seleccionado, limpiamos grilla
      if (
        String(periodoId) === String(item.periodo_id) &&
        String(labId) === String(item.lab_id)
      ) {
        setPlan([]);
        setCurrentKey(null);
      }

      // mensaje que manda el backend
      if (data.msg) {
        alert(data.msg);
      } else {
        alert(
          catShowDeleted
            ? "Horario eliminado permanentemente"
            : "Horario eliminado"
        );
      }
    } catch (e) {
      console.error(e);
      alert(
        catShowDeleted
          ? "No se pudo eliminar permanentemente el horario"
          : "No se pudo eliminar el horario"
      );
    } finally {
      // SIEMPRE recargo el catálogo para que no se quede bug visual
      await cargarCatalogo(catShowDeleted);
    }
  };

  const restaurarHorario = async (item) => {
    try {
      const { data } = await horariosApi.restore({
        periodo_id: item.periodo_id,
        lab_id: item.lab_id,
      });

      if (!data?.ok) {
        alert(data.msg || "No se pudo restaurar el horario");
        return;
      }

      // recarga catálogos respetando el estado del checkbox
      await cargarCatalogo(catShowDeleted);

      // si justo es el que tengo seleccionado, recargo la semana
      if (
        String(periodoId) === String(item.periodo_id) &&
        String(labId) === String(item.lab_id)
      ) {
        await cargarSemana(item.periodo_id, item.lab_id);
      }
    } catch (e) {
      console.error(e);
      alert("No se pudo restaurar el horario");
    }
  };

  const descargarPdf = async (item) => {
    try {
      const res = await horariosApi.pdf({
        periodo_id: item.periodo_id,
        lab_id: item.lab_id,
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `horario-${item.periodo_nombre}-${item.lab_nombre}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("No se pudo generar el PDF");
    }
  };

  /* ==========================
     Cargar horario (grilla)
     ========================== */
  const cargarSemana = async (pid, lid) => {
    const periodo = pid ?? periodoId;
    const lab = lid ?? labId;

    if (!periodo || !lab) {
      setPlan([]);
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const { data } = await horariosApi.semana({
        periodo_id: periodo,
        lab_id: lab,
      });

      let raw =
        data?.bloques ??
        data?.data ??
        data?.items ??
        data;

      if (!Array.isArray(raw)) {
        raw = [];
      }

      const normalizados = raw.map((b) => ({
        ...b,
        dia: normalizarDia(b.dia),
        hora_ini: String(b.hora_ini || "").slice(0, 5),
        hora_fin: String(b.hora_fin || "").slice(0, 5),
        docente_id: b.docente_id ? Number(b.docente_id) : null,
      }));

      setPlan(normalizados);
    } catch (e) {
      console.error(e);
      setErr("No se pudo cargar la semana");
      setPlan([]);
    } finally {
      setLoading(false);
    }
  };

  // Helpers para saber si existe un horario en esa combinación
  const existeHorario = (pid, lid) =>
    catalogo.find(
      (c) =>
        String(c.periodo_id) === String(pid) &&
        String(c.lab_id) === String(lid) &&
        !c.horario_eliminado
    ) || null;

  // Cambiar periodo / lab
  const handlePeriodoChange = async (e) => {
    const value = e.target.value;
    const nuevoPeriodo = value || "";
    const nuevoLab = labId || "";

    // Si estoy editando un horario y quiero moverlo a una combinación
    // que YA tiene horario, no lo permito.
    if (
      currentKey &&
      nuevoPeriodo &&
      nuevoLab &&
      (nuevoPeriodo !== currentKey.periodo_id ||
        nuevoLab !== currentKey.lab_id)
    ) {
      const existe = existeHorario(nuevoPeriodo, nuevoLab);
      if (existe) {
        alert(
          "Ya existe un horario para ese período y laboratorio. No se puede mover este horario ahí."
        );
        // regresar selects a la combinación original
        setPeriodoId(String(currentKey.periodo_id));
        setLabId(String(currentKey.lab_id));
        return;
      }
    }

    setPeriodoId(nuevoPeriodo);

    // Si NO estoy editando (horario nuevo) y existe uno, lo cargo.
    if (!currentKey && nuevoPeriodo && nuevoLab) {
      const existe = existeHorario(nuevoPeriodo, nuevoLab);
      if (existe) {
        await cargarSemana(nuevoPeriodo, nuevoLab);
      } else {
        setPlan([]);
      }
    }
  };

  const handleLabChange = async (e) => {
    const value = e.target.value;
    const nuevoLab = value || "";
    const nuevoPeriodo = periodoId || "";

    if (
      currentKey &&
      nuevoPeriodo &&
      nuevoLab &&
      (nuevoPeriodo !== currentKey.periodo_id ||
        nuevoLab !== currentKey.lab_id)
    ) {
      const existe = existeHorario(nuevoPeriodo, nuevoLab);
      if (existe) {
        alert(
          "Ya existe un horario para ese período y laboratorio. No se puede mover este horario ahí."
        );
        setPeriodoId(String(currentKey.periodo_id));
        setLabId(String(currentKey.lab_id));
        return;
      }
    }

    setLabId(nuevoLab);

    if (!currentKey && nuevoPeriodo && nuevoLab) {
      const existe = existeHorario(nuevoPeriodo, nuevoLab);
      if (existe) {
        await cargarSemana(nuevoPeriodo, nuevoLab);
      } else {
        setPlan([]);
      }
    }
  };

  /* ==========================
     Helpers grilla
     ========================== */
  const cellBloques = (dia, hhmm) =>
    plan.filter(
      (b) =>
        Number(b.dia) === Number(dia) &&
        b.hora_ini <= hhmm &&
        b.hora_fin > hhmm
    );

  // Eliminar SOLO la casilla (30 min) donde se hizo clic
  const onDeleteBloque = (b, hhmm) => {
    if (
      !confirm(
        "¿Eliminar solo este bloque de 30 minutos de la clase (puede acortar la duración)?"
      )
    )
      return;

    setPlan((prev) => {
      const out = [];
      const sliceIni = hhmm;
      const sliceFin = addMinutes(hhmm, 30);

      for (const x of prev) {
        if (x !== b) {
          out.push(x);
          continue;
        }

        const ini = x.hora_ini;
        const fin = x.hora_fin;

        // borrar todo el bloque
        if (sliceIni <= ini && sliceFin >= fin) {
          continue;
        }

        // Borrar al inicio
        if (sliceIni <= ini && sliceFin < fin) {
          const newIni = sliceFin;
          if (toMin(newIni) < toMin(fin)) {
            out.push({ ...x, hora_ini: newIni });
          }
          continue;
        }

        // Borrar al final
        if (sliceIni > ini && sliceFin >= fin) {
          const newFin = sliceIni;
          if (toMin(newFin) > toMin(ini)) {
            out.push({ ...x, hora_fin: newFin });
          }
          continue;
        }

        // Borrar en medio: dividir en dos
        if (sliceIni > ini && sliceFin < fin) {
          const leftFin = sliceIni;
          const rightIni = sliceFin;

          if (toMin(leftFin) > toMin(ini)) {
            out.push({ ...x, hora_fin: leftFin });
          }
          if (toMin(rightIni) < toMin(fin)) {
            out.push({
              ...x,
              id: undefined,
              hora_ini: rightIni,
            });
          }
          continue;
        }

        out.push(x);
      }

      return out;
    });
  };

  const guardar = async () => {
    if (!periodoId || !labId)
      return alert("Selecciona periodo y laboratorio");

    // Validar docente
    for (const b of plan) {
      if (!b.docente_id) {
        alert(
          "Hay bloques sin docente asignado. Todos los bloques deben tener un docente/admin/superadmin."
        );
        return;
      }
    }

    // Validar que NO haya traslapes en un mismo día dentro del mismo horario
    for (let d = 1; d <= 5; d++) {
      const bloquesDia = plan
        .filter((b) => Number(b.dia) === d)
        .map((b) => ({
          ini: toMin(b.hora_ini),
          fin: toMin(b.hora_fin),
        }))
        .sort((a, b) => a.ini - b.ini);

      for (let i = 0; i < bloquesDia.length; i++) {
        for (let j = i + 1; j < bloquesDia.length; j++) {
          const a = bloquesDia[i];
          const b = bloquesDia[j];
          const seTraslapan = !(a.fin <= b.ini || b.fin <= a.ini);
          if (seTraslapan) {
            alert(
              "Hay clases encimadas en el mismo día dentro de este laboratorio. Ajusta las horas para que no se traslapen."
            );
            return;
          }
        }
      }
    }

    try {
      const payload = {
        periodo_id: Number(periodoId),
        lab_id: Number(labId),
        upserts: plan,
      };

      // si estoy moviendo el horario a otro periodo / lab, mando los originales
      if (
        currentKey &&
        (String(currentKey.periodo_id) !== String(periodoId) ||
          String(currentKey.lab_id) !== String(labId))
      ) {
        payload.from_periodo_id = Number(currentKey.periodo_id);
        payload.from_lab_id = Number(currentKey.lab_id);
      }

      const { data } = await horariosApi.bulk(payload);

      if (!data?.ok) {
        alert(
          data.msg ||
            "No se pudo guardar el horario. Revisa que no existan conflictos de docentes entre laboratorios."
        );
        return;
      }

      await cargarSemana();
      await cargarCatalogo();

      // el horario guardado (o movido) pasa a ser el actual
      setCurrentKey({
        periodo_id: String(periodoId),
        lab_id: String(labId),
      });

      alert("Horario guardado");
    } catch (e) {
      console.error(e);
      alert(
        e.response?.data?.msg ||
          "Error al guardar. Revisa que no haya conflictos de horarios de docentes."
      );
    }
  };

  /* ==========================
     Editor flotante
     ========================== */
  const [editor, setEditor] = useState(null);

  const openEditor = (e, dia, hora_ini) => {
    if (!periodoId || !labId) return;

    const wrap = wrapRef.current;
    if (!wrap) return;

    const cellRect = e.currentTarget.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();

    let left = cellRect.left - wrapRect.left + wrap.scrollLeft + 8;
    const top = cellRect.top - wrapRect.top + wrap.scrollTop + 8;

    const POPOVER_W = 540;
    const maxLeft = wrap.scrollWidth - POPOVER_W - 16;
    if (left > maxLeft) left = Math.max(8, maxLeft);

    const existing = cellBloques(dia, hora_ini)[0] || null;

    setEditor({
      dia,
      hora_ini, // casilla
      left,
      top,
      existing,
    });
  };

  const closeEditor = () => setEditor(null);

  const upsertFromEditor = (payload, existing) => {
    setPlan((prev) => {
      if (!existing) {
        return [...prev, payload];
      }
      return prev.map((b) => (b === existing ? { ...existing, ...payload } : b));
    });
    setEditor(null);
  };

  const tituloActual = useMemo(() => {
    if (!periodoId || !labId) return "";
    const p = periodos.find((x) => String(x.id) === String(periodoId));
    const l = labs.find((x) => String(x.id) === String(labId));
    if (!p || !l) return "";
    return `${p.nombre} — ${l.nombre}`;
  }, [periodos, labs, periodoId, labId]);

  /* ==========================
     Render
     ========================== */

  return (
    <div className="page-shell hs-page">
      <div className="hs__card">
        <div className="hs__brand">Catálogo — Horarios</div>
        <div className="hs__sub">
          {tituloActual
            ? `Editando: ${tituloActual}`
            : "Crea y administra los horarios por laboratorio"}
        </div>

        {/* ======= Resumen del horario seleccionado ======= */}
        {horarioActual && !catShowDeleted && (
          <div className="hs-summary">
            <div className="hs-summary__left">
              <div className="hs-summary__title">
                <strong>{horarioActual.periodo_nombre}</strong>
                <span> · {horarioActual.lab_nombre}</span>
              </div>
              <div className="hs-summary__meta">
                <span>
                  {horarioActual.periodo_ini} — {horarioActual.periodo_fin}
                </span>
                <span>{horarioActual.bloques_activos} bloque(s)</span>
              </div>
            </div>
            <div className="hs-summary__right">
              <span
                className={
                  "pill " +
                  (horarioActual.en_curso ? "pill-warn" : "pill-ok")
                }
              >
                {horarioActual.en_curso ? "En curso" : "Fuera de periodo"}
              </span>
              <span
                className={
                  "pill " +
                  (horarioActual.horario_eliminado
                    ? "pill-muted"
                    : horarioActual.activo
                    ? "pill-ok"
                    : "pill-grey")
                }
              >
                {horarioActual.horario_eliminado
                  ? "Eliminado"
                  : horarioActual.activo
                  ? "Activo"
                  : "Inactivo"}
              </span>
            </div>
          </div>
        )}

        {/* ======= Catálogo de horarios guardados ======= */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <input
              className="input"
              style={{ flex: "1 1 220px" }}
              placeholder="Buscar por periodo o laboratorio…"
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
            />
            <button className="btn ghost" onClick={() => cargarCatalogo()}>
              Buscar
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setCatSearch("");
                setCatShowDeleted(false);
                cargarCatalogo(false);
              }}
            >
              Limpiar
            </button>
            <label
              style={{
                fontSize: 12,
                color: "#4B5563",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <input
                type="checkbox"
                checked={catShowDeleted}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCatShowDeleted(checked);
                  cargarCatalogo(checked);
                }}
              />
              Mostrar eliminados
            </label>
          </div>

          <div className="card list">
            {!Array.isArray(catalogo) || catalogo.length === 0 ? (
              <p className="hs__muted">
                {catShowDeleted
                  ? "No hay horarios eliminados."
                  : "Aún no hay horarios guardados."}
              </p>
            ) : (
              catalogo.map((item) => (
                <div
                  className="row"
                  key={`${item.periodo_id}-${item.lab_id}`}
                >
                  <div className="row__title">
                    <div>
                      <strong>{item.periodo_nombre}</strong>
                      <span className="row__lab">{item.lab_nombre}</span>
                    </div>
                  </div>
                  <div className="row__meta">
                    <span>
                      {item.periodo_ini} — {item.periodo_fin}
                    </span>
                    <span className="pill pill-muted">
                      {item.bloques_activos} bloque(s)
                    </span>
                    {!catShowDeleted && (
                      <>
                        <span
                          className={
                            "pill " +
                            (item.en_curso ? "pill-warn" : "pill-ok")
                          }
                        >
                          {item.en_curso ? "En curso" : "Fuera de periodo"}
                        </span>
                        <span
                          className={
                            "pill " +
                            (item.horario_eliminado
                              ? "pill-muted"
                              : item.activo
                              ? "pill-ok"
                              : "pill-grey")
                          }
                        >
                          {item.horario_eliminado
                            ? "Eliminado"
                            : item.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="row__actions">
                    {!catShowDeleted && (
                      <>
                        <button
                          className="btn ghost"
                          onClick={() => abrirHorario(item)}
                        >
                          Ver / editar
                        </button>

                        <button
                          className="btn ghost"
                          onClick={() => toggleActivo(item)}
                          disabled={item.horario_eliminado}
                        >
                          {item.activo ? "Desactivar" : "Activar"}
                        </button>
                      </>
                    )}

                    <button
                      className="btn ghost"
                      onClick={() => descargarPdf(item)}
                    >
                      PDF
                    </button>

                    {!catShowDeleted ? (
                      <button
                        className="btn danger"
                        onClick={() => eliminarHorario(item)}
                      >
                        Eliminar
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn ghost"
                          onClick={() => restaurarHorario(item)}
                        >
                          Restaurar
                        </button>
                        <button
                          className="btn danger"
                          onClick={() => eliminarHorario(item)}
                        >
                          Eliminar permanente
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ======= Filtros y grilla de edición ======= */}
        <div className="hs__filters">
          <button
            className="btn"
            style={{ background: "#4C1D95" }}
            onClick={() => nav(-1)}
          >
            ◂ Regresar
          </button>

          <select
            className="input"
            value={periodoId}
            onChange={handlePeriodoChange}
          >
            <option value="">Periodo…</option>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={labId}
            onChange={handleLabChange}
          >
            <option value="">Laboratorio…</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>

          <div className="hs__actions">
            <button
              className="btn ghost"
              onClick={() => {
                setPeriodoId("");
                setLabId("");
                setPlan([]);
                setCurrentKey(null); // nuevo horario
              }}
            >
              Nuevo horario
            </button>
            <button
              className="btn ghost"
              onClick={() => cargarSemana()}
              disabled={loading || !periodoId || !labId}
            >
              Actualizar
            </button>
            <button className="btn" onClick={guardar}>
              Guardar semana
            </button>
          </div>
        </div>

        {err && (
          <p className="hs__muted" style={{ color: "#B91C1C" }}>
            {err}
          </p>
        )}
        {!periodoId || !labId ? (
          <p className="hs__muted">
            Selecciona un periodo y un laboratorio para crear o editar el
            horario.
          </p>
        ) : null}

        <div className="hs__wrap" ref={wrapRef}>
          <table className="hs__grid">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Hora</th>
                {DIAS.map((d) => (
                  <th key={d.id}>{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horasMedias.map((hhmm) => (
                <tr key={hhmm}>
                  <td className="hs__time">{hhmm}</td>
                  {DIAS.map((d) => {
                    const b = cellBloques(d.id, hhmm)[0] || null;
                    const palette = b
                      ? colorFor(String(b.codigo || b.materia || "x"))
                      : null;

                    const docente =
                      b && b.docente_id
                        ? docentes.find(
                            (u) => Number(u.id) === Number(b.docente_id)
                          )
                        : null;
                    const docenteLabel = docente ? docente._label : null;

                    return (
                      <td
                        key={d.id}
                        className="hs__cell"
                        onDoubleClick={(e) => openEditor(e, d.id, hhmm)}
                        title="Doble clic para crear o editar bloque"
                      >
                        {b && (
                          <div
                            className="hs__block"
                            style={{
                              background: palette.bg,
                              borderColor: palette.bd,
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <div className="hs__btitle">
                              {tituloBloque(b)}
                            </div>
                            <div className="hs__bmeta">{metaGrupo(b)}</div>
                            <div className="hs__bmeta">
                              <strong>Imparte:</strong>{" "}
                              {docenteLabel ||
                                b.docente_nombre ||
                                "Sin docente asignado"}
                            </div>
                            <button
                              className="hs__mini danger"
                              onClick={() => onDeleteBloque(b, hhmm)}
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {editor && (
            <PopoverEditor
              style={{ left: editor.left, top: editor.top }}
              base={{
                periodo_id: Number(periodoId),
                lab_id: Number(labId),
                dia: editor.dia,
                hora_ini: editor.hora_ini,
              }}
              docentes={docentes}
              existing={editor.existing}
              onCancel={closeEditor}
              onSave={upsertFromEditor}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PopoverEditor({ style, base, docentes, existing, onCancel, onSave }) {
  const [materia, setMateria] = useState(existing?.materia ?? "");
  const [codigo, setCodigo] = useState(existing?.codigo ?? "");
  const [grupo, setGrupo] = useState(existing?.grupo ?? "");
  const [docenteId, setDocenteId] = useState(
    existing?.docente_id ? String(existing.docente_id) : ""
  );

  const [horaIni, setHoraIni] = useState(
    existing?.hora_ini || base.hora_ini
  );
  const horasIni = useMemo(
    () => timeRange("07:00", "18:30", 30),
    []
  );

  const [horaFin, setHoraFin] = useState(
    existing?.hora_fin || addMinutes(base.hora_ini, 60)
  );

  const horasFin = useMemo(
    () => timeRange(horaIni, "19:00", 30).slice(1),
    [horaIni]
  );

  const submit = () => {
    if (horaFin <= horaIni)
      return alert("Hora fin debe ser mayor que inicio");

    if (!docenteId) {
      alert(
        "Selecciona quién imparte la clase (docente, admin o superadmin)."
      );
      return;
    }

    const payload = {
      ...base,
      hora_ini: horaIni,
      hora_fin: horaFin,
      materia: materia || null,
      codigo: codigo || null,
      docente_id: Number(docenteId),
      grupo: grupo || null,
      activo: 1,
    };

    if (existing?.id) {
      payload.id = existing.id;
    }

    onSave(payload, existing || null);
  };

  return (
    <div className="hs-pop" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="hs-pop__head">
        <strong>
          {["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"][base.dia]}{" "}
          {base.hora_ini}
        </strong>
        <button className="hs-pop__x" onClick={onCancel}>
          ×
        </button>
      </div>

      <div className="hs-pop__row2">
        <div>
          <label>Materia</label>
          <input
            className="cell-input"
            placeholder="Programación"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
          />
        </div>
        <div>
          <label>Código</label>
          <input
            className="cell-input"
            placeholder="253-9735"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>
      </div>

      <label style={{ marginTop: 6 }}>Imparte</label>
      <select
        className="cell-input"
        value={docenteId}
        onChange={(e) => setDocenteId(e.target.value)}
      >
        <option value="">Seleccionar…</option>
        {docentes.map((u) => (
          <option key={u.id} value={u.id}>
            {u._label}
          </option>
        ))}
      </select>

      <div className="hs-pop__row">
        <div>
          <label>Grupo</label>
          <input
            className="cell-input"
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            placeholder="RETL_07_02"
          />
        </div>
        <div>
          <label>Hora inicio</label>
          <select
            className="cell-input"
            value={horaIni}
            onChange={(e) => setHoraIni(e.target.value)}
          >
            {horasIni.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Hora fin</label>
          <select
            className="cell-input"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
          >
            {horasFin.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="hs-actions"
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 10,
        }}
      >
        <button className="btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn" onClick={submit}>
          Guardar
        </button>
      </div>
    </div>
  );
}

/* Helpers */
function addMinutes(hhmm, m) {
  const [H, M] = hhmm.split(":").map(Number);
  const t = H * 60 + M + m;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(
    t % 60
  ).padStart(2, "0")}`;
}
function timeRange(from, to, step) {
  const toMinLoc = (s) => {
    const [H, M] = s.split(":").map(Number);
    return H * 60 + M;
  };
  const out = [];
  for (let t = toMinLoc(from); t <= toMinLoc(to); t += step) {
    out.push(
      `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(
        t % 60
      ).padStart(2, "0")}`
    );
  }
  return out;
}
