import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listParametros,
  createParametro,
  updateParametro,
  setParametroActivo,
  deleteParametro,
} from "../services/parametrosApi";
import "./parametros.css";

const SCOPES = ["GLOBAL", "ROL", "LAB", "PERIODO", "USUARIO"];
const TIPOS = ["string", "int", "float", "bool", "json"];

const norm = (s) => String(s ?? "").trim();

function validate(tipo, valor) {
  const t = String(tipo || "string").toLowerCase();
  const v = valor ?? "";

  if (t === "bool") {
    const s = String(v).toLowerCase().trim();
    if (!["true", "false", "1", "0", "si", "sí", "no"].includes(s)) {
      return "Bool inválido (usa true/false)";
    }
  }
  if (t === "int") {
    const n = Number(v);
    if (!Number.isInteger(n)) return "Int inválido";
  }
  if (t === "float") {
    const n = Number(v);
    if (Number.isNaN(n)) return "Float inválido";
  }
  if (t === "json") {
    try { JSON.parse(String(v)); } catch { return "JSON inválido"; }
  }
  return "";
}

export default function ParametrosAdmin() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [scope, setScope] = useState("GLOBAL");
  const [activo, setActivo] = useState("1"); // "1" | "0" | "all"
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null); // item seleccionado

  // form
  const [clave, setClave] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("string");
  const [scopeForm, setScopeForm] = useState("GLOBAL");
  const [scopeRefId, setScopeRefId] = useState("");
  const [valor, setValor] = useState("");
  const [activoForm, setActivoForm] = useState(true);

  const resetForm = () => {
    setSelected(null);
    setClave("");
    setDescripcion("");
    setTipo("string");
    setScopeForm("GLOBAL");
    setScopeRefId("");
    setValor("");
    setActivoForm(true);
  };

  const fillForm = (it) => {
    setSelected(it);
    setClave(it.clave ?? "");
    setDescripcion(it.descripcion ?? "");
    setTipo(it.tipo ?? "string");
    setScopeForm(it.scope ?? "GLOBAL");
    setScopeRefId(it.scope_ref_id ?? "");
    setValor(it.valor ?? "");
    setActivoForm(Boolean(it.activo));
  };

  const fetchAll = async () => {
    try {
      setLoading(true);

      const params = {};
      if (norm(q)) params.q = norm(q);
      if (scope) params.scope = scope;
      if (activo !== "all") params.activo = activo;

      const { data } = await listParametros(params);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      alert("No se pudieron cargar los parámetros.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, activo]);

  const filtered = useMemo(() => {
    const qq = norm(q).toLowerCase();
    if (!qq) return items;
    return items.filter((x) => {
      const a = (x.clave || "").toLowerCase();
      const b = (x.descripcion || "").toLowerCase();
      return a.includes(qq) || b.includes(qq);
    });
  }, [items, q]);

  const onSave = async () => {
    const c = norm(clave);
    if (!c) return alert("Clave requerida");
    if (!SCOPES.includes(scopeForm)) return alert("Scope inválido");
    if (!TIPOS.includes(tipo)) return alert("Tipo inválido");

    if (scopeForm !== "GLOBAL" && !String(scopeRefId).trim()) {
      return alert("scope_ref_id es requerido cuando el scope no es GLOBAL");
    }

    const err = validate(tipo, valor);
    if (err) return alert(err);

    const payload = {
      clave: c,
      descripcion: norm(descripcion),
      tipo,
      valor,
      scope: scopeForm,
      scope_ref_id: scopeForm === "GLOBAL" ? null : Number(scopeRefId),
      activo: activoForm ? 1 : 0,
    };

    try {
      setLoading(true);
      if (selected?.id) {
        await updateParametro(selected.id, payload);
      } else {
        await createParametro(payload);
      }
      await fetchAll();
      resetForm();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  const onToggle = async (it) => {
    try {
      await setParametroActivo(it.id, it.activo ? 0 : 1);
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar activo");
    }
  };

  const onDelete = async (it) => {
    if (!confirm(`¿Eliminar parámetro "${it.clave}"?`)) return;
    try {
      await deleteParametro(it.id);
      await fetchAll();
      if (selected?.id === it.id) resetForm();
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar");
    }
  };

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card parametros-wrap">
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Parámetros del sistema</h1>
          <button className="btn btn-refresh" onClick={fetchAll} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>

        {/* FILTROS */}
        <div className="param-filters">
          <input
            className="param-input"
            placeholder="Buscar por clave / descripción…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select className="param-input" value={scope} onChange={(e) => setScope(e.target.value)}>
            {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select className="param-input" value={activo} onChange={(e) => setActivo(e.target.value)}>
            <option value="1">Activos</option>
            <option value="0">Inactivos</option>
            <option value="all">Todos</option>
          </select>

          <button className="btn-ghost" onClick={resetForm} type="button">
            Nuevo
          </button>
        </div>

        <div className="param-grid">
          {/* LISTA */}
          <div className="param-list">
            {filtered.length === 0 ? (
              <div className="empty">No hay parámetros.</div>
            ) : (
              filtered.map((it) => (
                <div
                  key={it.id}
                  className={`param-item ${selected?.id === it.id ? "is-active" : ""}`}
                  onClick={() => fillForm(it)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="pi-left">
                    <div className="pi-title">{it.clave}</div>
                    <div className="pi-sub">{it.descripcion || "—"}</div>
                    <div className="pi-meta">
                      <span className="pill">{it.scope}{it.scope_ref_id ? ` #${it.scope_ref_id}` : ""}</span>
                      <span className="pill">{it.tipo}</span>
                      <span className={`badge ${it.activo ? "green" : "red"}`}>
                        {it.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>

                  <div className="pi-actions">
                    <button className="pill" onClick={(e) => { e.stopPropagation(); onToggle(it); }}>
                      {it.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button className="icon" onClick={(e) => { e.stopPropagation(); onDelete(it); }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* FORM */}
          <div className="param-form">
            <h2>{selected ? "Editar parámetro" : "Nuevo parámetro"}</h2>

            <label className="lbl">Clave</label>
            <input className="param-input" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="ej. asistencia.ventana_minutos_antes" />

            <label className="lbl">Descripción</label>
            <input className="param-input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción corta" />

            <div className="row2">
              <div>
                <label className="lbl">Tipo</label>
                <select className="param-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="lbl">Scope</label>
                <select className="param-input" value={scopeForm} onChange={(e) => setScopeForm(e.target.value)}>
                  {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <label className="lbl">Scope ref id (opcional)</label>
            <input
              className="param-input"
              value={scopeRefId}
              onChange={(e) => setScopeRefId(e.target.value)}
              placeholder="ej. id de lab/periodo/usuario"
              disabled={scopeForm === "GLOBAL"}
            />

            <label className="lbl">Valor</label>
            <textarea
              className="param-input area"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Valor…"
            />

            <div className="row-actions">
              <label className="chk">
                <input type="checkbox" checked={activoForm} onChange={(e) => setActivoForm(e.target.checked)} />
                Activo
              </label>

              <div className="btns">
                <button className="btn-ghost" onClick={resetForm} type="button">Limpiar</button>
                <button className="btn-save" onClick={onSave} disabled={loading} type="button">
                  {loading ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>

            <div className="tip">
              Tip: si el tipo es <b>json</b>, el valor debe ser JSON válido.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
