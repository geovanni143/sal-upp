import { useEffect, useState } from "react";
import { usersApi } from "../api/http";
import { useNavigate } from "react-router-dom";
import "./menu.css";

export default function UsersPage() {
  const nav = useNavigate();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ id: null, nombre: "", email: "", rol: "docente", password: "", activo: 1 });
  const [modoEdicion, setModoEdicion] = useState(false);

  const load = async () => {
    const { data } = await usersApi.list();
    setUsers(data);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.id) await usersApi.update(form.id, form);
    else await usersApi.create(form);
    await load();
    setForm({ id: null, nombre: "", email: "", rol: "docente", password: "", activo: 1 });
    setModoEdicion(false);
  };

  const handleEdit = (u) => { setForm(u); setModoEdicion(true); };
  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar usuario?")) return;
    await usersApi.remove(id);
    await load();
  };

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 480 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Catálogo — Usuarios</h1>
        </div>

        <div className="list-container">
          {users.map((u) => (
            <div key={u.id} className="list-item">
              <div className="item-info">
                <h4>{u.nombre}</h4>
                <p>{u.email}</p>
                <small>{u.rol}</small>
              </div>
              <div className="item-actions">
                <button className="btn-edit" onClick={() => handleEdit(u)}>Editar</button>
                <button className="btn-delete" onClick={() => handleDelete(u.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="form-box">
          <h2>{modoEdicion ? "Editar" : "Crear"} Usuario</h2>
          <label>Nombre:</label>
          <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />

          <label>Email:</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />

          <label>Rol:</label>
          <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            <option value="docente">Docente</option>
            <option value="admin_lab">Admin Lab</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>

          <label>Contraseña (opcional al editar):</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

          <div className="btn-row">
            <button type="button" className="btn-cancel" onClick={() => setForm({ id: null, nombre: "", email: "", rol: "docente", password: "", activo: 1 })}>Cancelar</button>
            <button type="submit" className="btn-save">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
