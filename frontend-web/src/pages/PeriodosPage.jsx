import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { periodosApi } from "../api/http";
import "./menu.css";

const EMPTY = { id: null, nombre: "", fecha_ini: "", fecha_fin: "" };

// Normaliza ISO/Date a YYYY-MM-DD (para inputs date)
const toYMD = (v) => {
  if (!v) return "";
  try {
    const d = typeof v === "string" ? new Date(v) : v;
    return d.toISOString().slice(0, 10);
  } catch {
    return String(v).slice(0, 10);
  }
};

// Estado automático por fechas (front fallback)
const getEstadoAuto = (fechaIni, fechaFin) => {
  const fi = toYMD(fechaIni);
  const ff = toYMD(fechaFin);
  if (!fi || !ff) return { key: "DESCONOCIDO", label: "Sin fechas", badge: "red" };

  const today = new Date();
  const t = new Date(today.toISOString().slice(0, 10)); // 00:00 local-ish
  const ini = new Date(fi);
  const fin = new Date(ff);

  if (t < ini) return { key: "PROXIMO", label: "Próximo", badge: "red" };
  if (t > fin) return { key: "FINALIZADO", label: "Finalizado", badge: "red" };
  return { key: "EN_CURSO", label: "En curso", badge: "green" };
};

export default function PeriodosPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verEliminados, setVerEliminados] = useState(false);
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await periodosApi.list({
        q,
        includeDeleted: verEliminados ? 1 : 0,
      });
      setRows(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [verEliminados]);

  const limpiar = () => setForm(EMPTY);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { id, nombre, fecha_ini, fecha_fin } = form;
      if (id) await periodosApi.update(id, { nombre, fecha_ini, fecha_fin });
      else await periodosApi.create({ nombre, fecha_ini, fecha_fin });
      limpiar();
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const editar = (r) => {
    const { id, nombre, fecha_ini, fecha_fin } = r;
    setForm({
      id,
      nombre,
      fecha_ini: toYMD(fecha_ini),
      fecha_fin: toYMD(fecha_fin),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar periodo? (se ocultará del catálogo)")) return;
    try {
      await periodosApi.remove(id);
      await load();
    } catch (e) {
      alert(e?.response?.data?.reason || e?.response?.data?.error || e.message);
    }
  };

  const restaurar = async (id) => {
    try {
      await periodosApi.restore(id);
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      `${r.nombre} ${r.fecha_ini} ${r.fecha_fin}`.toLowerCase().includes(t)
    );
  }, [rows, q]);

  return (
    <div className="page-shell">
      <div className="menu-card manage-narrow">
        <div className="menu-head">
          <div className="brand">Catálogo — Periodos</div>
          <div className="menu-sub">Crear / editar / eliminar y ver estado</div>
        </div>

        <div className="manage-footer" style={{ marginBottom: 12 }}>
          <button className="manage-back" type="button" onClick={() => nav(-1)}>
            ← Regresar
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            className="input"
            placeholder="Buscar por nombre o fechas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Cargando…" : "Buscar"}
          </button>
          <button className="btn ghost" onClick={() => { setQ(""); load(); }}>
            Limpiar
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={verEliminados}
              onChange={(e) => setVerEliminados(e.target.checked)}
            />
            Mostrar eliminados
          </label>
        </div>

        {error && <p className="error-inline">{error}</p>}

        <ul className="manage-list">
          {list.map((r) => {
            // Si backend ya manda estado/activo calculado, úsalo
            const estadoBackend = r.estado; // "PROXIMO" | "EN_CURSO" | "FINALIZADO"
            const activoBackend = typeof r.activo === "number" ? r.activo : (r.activo ? 1 : 0);

            // fallback por fechas si no viene estado
            const auto = getEstadoAuto(r.fecha_ini, r.fecha_fin);

            const estadoKey = estadoBackend || auto.key;
            const estadoLabel =
              estadoBackend === "EN_CURSO" ? "En curso"
              : estadoBackend === "PROXIMO" ? "Próximo"
              : estadoBackend === "FINALIZADO" ? "Finalizado"
              : auto.label;

            const badgeClass =
              r.eliminado ? "amber"
              : (estadoKey === "EN_CURSO" || activoBackend === 1) ? "green"
              : "red";

            return (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#F7FAFF",
                  borderRadius: 14,
                  padding: "10px 12px",
                  opacity: r.eliminado ? 0.6 : 1,
                }}
              >
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontWeight: 800 }}>{r.nombre}</div>
                  <div style={{ fontSize: 13, color: "#334155" }}>
                    {toYMD(r.fecha_ini)} → {toYMD(r.fecha_fin)}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.eliminado ? (
                    <span className="badge amber">Eliminado</span>
                  ) : (
                    <span className={`badge ${badgeClass}`}>
                      {estadoLabel}
                    </span>
                  )}

                  {!r.eliminado && (
                    <>
                      <button className="btn icon" title="Editar" onClick={() => editar(r)}>
                        ✎
                      </button>
                      <button
                        className="btn icon danger"
                        title="Eliminar"
                        onClick={() => eliminar(r.id)}
                      >
                        🗑
                      </button>
                    </>
                  )}

                  {r.eliminado && (
                    <button className="btn icon" title="Restaurar" onClick={() => restaurar(r.id)}>
                      ⤴
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {!loading && list.length === 0 && <li className="empty">Sin resultados.</li>}
        </ul>

        <h3 style={{ margin: "12px 4px 8px" }}>{form.id ? "Editar" : "Crear"} periodo</h3>

        <form onSubmit={submit} className="form-card">
          <div className="form-row">
            <label>Nombre:</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label>Fecha Inicio:</label>
            <input
              type="date"
              value={form.fecha_ini || ""}
              onChange={(e) => setForm({ ...form, fecha_ini: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label>Fecha Fin:</label>
            <input
              type="date"
              value={form.fecha_fin || ""}
              onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
              required
            />
          </div>
          <div className="actions-grid">
            <button type="button" className="btn-secondary-ghost" onClick={limpiar}>
              Cancelar
            </button>
            <button type="submit" className="btn-wide">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
