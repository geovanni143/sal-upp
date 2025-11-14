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

// ya NO mostramos horas dentro del bloque, solo grupo
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

  // Horario actual en edición (bloques)
  const [plan, setPlan] = useState([]);

  // Catálogo de horarios guardados
  const [catalogo, setCatalogo] = useState([]);
  const [catSearch, setCatSearch] = useState("");
  const [catShowDeleted, setCatShowDeleted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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
     Catálogo de horarios (lista de arriba)
     ========================== */
  const cargarCatalogo = async () => {
    try {
      const { data } = await horariosApi.catalogo({
        search: catSearch || undefined,
        mostrar_eliminados: catShowDeleted ? 1 : 0,
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
        horario_eliminado: Number(it.eliminado ?? 0) === 1,
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
    await cargarSemana(pid, lid); // baja bloques del backend y llena la tabla
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

  const eliminarHorario = async (item) => {
    // Regla: mientras el periodo esté en curso NO se puede borrar el horario completo
    if (item.en_curso) {
      alert(
        "No puedes eliminar un horario cuyo periodo está en curso. Solo puedes editar sus bloques."
      );
      return;
    }

    if (
      !confirm(
        "¿Eliminar TODO el horario de este laboratorio en ese período? (se puede restaurar después)"
      )
    )
      return;

    try {
      const { data } = await horariosApi.eliminar({
        periodo_id: item.periodo_id,
        lab_id: item.lab_id,
      });

      if (!data?.ok) {
        alert(data.msg || "No se pudo eliminar el horario");
        return;
      }

      if (
        String(periodoId) === String(item.periodo_id) &&
        String(labId) === String(item.lab_id)
      ) {
        setPlan([]);
      }
      await cargarCatalogo();
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el horario");
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

      await cargarCatalogo();

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

      console.log("SEMANA resp:", data);

      // Soportar varios formatos: {bloques:[...]}, {ok:true,bloques:[...]}, {data:[...]}, [...]
      let raw =
        data?.bloques ??
        data?.data ??
        data?.items ??
        data;

      if (!Array.isArray(raw)) {
        raw = [];
      }

      // 🔧 Normalizar lo que viene del backend para que la grilla lo pueda usar
      const normalizados = raw.map((b) => ({
        ...b,
        dia: normalizarDia(b.dia),
        hora_ini: String(b.hora_ini || "").slice(0, 5), // "07:00:00" -> "07:00"
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

  // Si cambia selección Periodo / Lab: nuevo horario o editar existente
  const handlePeriodoChange = async (e) => {
    const value = e.target.value;
    setPeriodoId(value);
    if (value && labId) {
      const existe = catalogo.find(
        (c) =>
          String(c.periodo_id) === String(value) &&
          String(c.lab_id) === String(labId) &&
          !c.horario_eliminado
      );
      if (existe) {
        await cargarSemana(value, labId); // ya existe → lo edito
      } else {
        setPlan([]); // nuevo horario
      }
    } else {
      setPlan([]);
    }
  };

  const handleLabChange = async (e) => {
    const value = e.target.value;
    setLabId(value);
    if (periodoId && value) {
      const existe = catalogo.find(
        (c) =>
          String(c.periodo_id) === String(periodoId) &&
          String(c.lab_id) === String(value) &&
          !c.horario_eliminado
      );
      if (existe) {
        await cargarSemana(periodoId, value); // ya existe → lo edito
      } else {
        setPlan([]); // nuevo horario
      }
    } else {
      setPlan([]);
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

  // Elimina TODO el bloque (7:00–9:30, etc.) aunque se vea repetido en varias filas
  const onDeleteBloque = (b) => {
    if (!confirm("¿Eliminar este bloque de clase (todas sus horas)?")) return;
    setPlan((prev) => prev.filter((x) => x !== b));
  };

  const guardar = async () => {
    if (!periodoId || !labId)
      return alert("Selecciona periodo y laboratorio");

    // Validar que ningún bloque se quede sin docente
    for (const b of plan) {
      if (!b.docente_id) {
        alert(
          "Hay bloques sin docente asignado. Todos los bloques deben tener un docente/admin/superadmin."
        );
        return;
      }
    }

    try {
      const { data } = await horariosApi.bulk({
        periodo_id: Number(periodoId),
        lab_id: Number(labId),
        upserts: plan,
      });

      if (!data?.ok) {
        alert(data.msg || "No se pudo guardar el horario");
        return;
      }

      await cargarSemana();
      await cargarCatalogo();
      alert("Horario guardado");
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
  };

  /* ==========================
     Editor flotante
     ========================== */
  const [editor, setEditor] = useState(null);

  const openEditor = (e, dia, hora_ini) => {
    if (!periodoId || !labId) return;

    // ahora SIEMPRE se puede editar (aunque el periodo esté en curso)
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
      hora_ini,
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
        {horarioActual && (
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
            <button className="btn ghost" onClick={cargarCatalogo}>
              Buscar
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setCatSearch("");
                setCatShowDeleted(false);
                cargarCatalogo();
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
                  setCatShowDeleted(e.target.checked);
                  setTimeout(cargarCatalogo, 0);
                }}
              />
              Mostrar eliminados
            </label>
          </div>

          <div className="card list">
            {!Array.isArray(catalogo) || catalogo.length === 0 ? (
              <p className="hs__muted">Aún no hay horarios guardados.</p>
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
                  </div>
                  <div className="row__actions">
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

                    {!item.horario_eliminado ? (
                      <button
                        className="btn danger"
                        onClick={() => eliminarHorario(item)}
                      >
                        Eliminar
                      </button>
                    ) : (
                      <button
                        className="btn ghost"
                        onClick={() => restaurarHorario(item)}
                      >
                        Restaurar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ======= Filtros y grilla de edición ======= */}
        <div className="hs__filters">
          <button className="btn ghost" onClick={() => nav(-1)}>
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
              onClick={() => cargarSemana()}
              disabled={loading}
            >
              Actualizar
            </button>
            <button className="btn" onClick={guardar}>
              Guardar semana
            </button>
            <button
              className="btn ghost"
              onClick={async () => {
                if (!periodoId || !labId) return;
                const res = await horariosApi.pdf({
                  periodo_id: periodoId,
                  lab_id: labId,
                });
                const url = URL.createObjectURL(res.data);
                const a = document.createElement("a");
                a.href = url;
                a.download = "horario.pdf";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              PDF
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

                    // buscar docente para mostrar siempre el nombre correcto
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
                              onClick={() => onDeleteBloque(b)}
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
  const [horaFin, setHoraFin] = useState(
    existing?.hora_fin || addMinutes(base.hora_ini, 60)
  );

  const horasFin = useMemo(
    () => timeRange(base.hora_ini, "19:00", 30).slice(1),
    [base.hora_ini]
  );

  const submit = () => {
    if (horaFin <= base.hora_ini)
      return alert("Hora fin debe ser mayor que inicio");

    if (!docenteId) {
      alert(
        "Selecciona quién imparte la clase (docente, admin o superadmin)."
      );
      return;
    }

    const payload = {
      ...base,
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
  const toMin = (s) => {
    const [H, M] = s.split(":").map(Number);
    return H * 60 + M;
  };
  const out = [];
  for (let t = toMin(from); t <= toMin(to); t += step) {
    out.push(
      `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(
        t % 60
      ).padStart(2, "0")}`
    );
  }
  return out;
}
