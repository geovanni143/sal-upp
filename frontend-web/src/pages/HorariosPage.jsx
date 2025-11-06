import { useEffect, useState } from "react";
import { horariosApi, periodosApi, labsApi, usersApi } from "../api/http";
import { useNavigate } from "react-router-dom";
import "./menu.css";

const DIAS = [
  { v: "lu", t: "Lunes" },
  { v: "ma", t: "Martes" },
  { v: "mi", t: "Miércoles" },
  { v: "ju", t: "Jueves" },
  { v: "vi", t: "Viernes" },
  { v: "sa", t: "Sábado" },
];

export default function HorariosPage() {
  const nav = useNavigate();
  const [horarios, setHorarios] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [labs, setLabs] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [form, setForm] = useState({
    id: null, periodo_id: "", lab_id: "", docente_id: "", dia: "lu", hora_ini: "07:00", hora_fin: "08:00", activo: 1
  });

  const loadData = async () => {
    const [{ data: per }, { data: lb }, { data: us }] = await Promise.all([
      periodosApi.list(), labsApi.list(), usersApi.list({ rol: "docente" })
    ]);
    setPeriodos(per);
    setLabs(lb);
    setDocentes(us);
  };

  const loadHorarios = async () => {
    const { data } = await horariosApi.list();
    setHorarios(data);
  };

  useEffect(() => { loadData(); loadHorarios(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.id) await horariosApi.update(form.id, form);
    else await horariosApi.create(form);
    await loadHorarios();
    setForm({ id: null, periodo_id: "", lab_id: "", docente_id: "", dia: "lu", hora_ini: "07:00", hora_fin: "08:00", activo: 1 });
  };

  const handleEdit = (r) => setForm(r);
  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar horario?")) return;
    await horariosApi.remove(id);
    await loadHorarios();
  };

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 520 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Catálogo — Horarios</h1>
        </div>

        <div className="list-container">
          {horarios.map((h) => (
            <div key={h.id} className="list-item">
              <div className="item-info">
                <h4>{h.lab}</h4>
                <p>{h.periodo} · {h.docente_nombre}</p>
                <small>{DIAS.find(d => d.v === h.dia)?.t} — {h.hora_ini} a {h.hora_fin}</small>
              </div>
              <div className="item-actions">
                <button className="btn-edit" onClick={() => handleEdit(h)}>Editar</button>
                <button className="btn-delete" onClick={() => handleDelete(h.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="form-box">
          <h2>{form.id ? "Editar" : "Crear"} Horario</h2>

          <label>Periodo:</label>
          <select value={form.periodo_id} onChange={(e) => setForm({ ...form, periodo_id: e.target.value })} required>
            <option value="">Selecciona un periodo</option>
            {periodos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>

          <label>Laboratorio:</label>
          <select value={form.lab_id} onChange={(e) => setForm({ ...form, lab_id: e.target.value })} required>
            <option value="">Selecciona un laboratorio</option>
            {labs.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>

          <label>Docente:</label>
          <select value={form.docente_id} onChange={(e) => setForm({ ...form, docente_id: e.target.value })} required>
            <option value="">Selecciona un docente</option>
            {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>

          <label>Día de la semana:</label>
          <select value={form.dia} onChange={(e) => setForm({ ...form, dia: e.target.value })}>
            {DIAS.map(d => <option key={d.v} value={d.v}>{d.t}</option>)}
          </select>

          <div className="grid-2">
            <div>
              <label>Hora inicio:</label>
              <input type="time" value={form.hora_ini} onChange={(e) => setForm({ ...form, hora_ini: e.target.value })} required />
            </div>
            <div>
              <label>Hora fin:</label>
              <input type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} required />
            </div>
          </div>

          <div className="btn-row">
            <button type="button" className="btn-cancel" onClick={() => setForm({ id: null, periodo_id: "", lab_id: "", docente_id: "", dia: "lu", hora_ini: "07:00", hora_fin: "08:00", activo: 1 })}>Cancelar</button>
            <button type="submit" className="btn-save">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
