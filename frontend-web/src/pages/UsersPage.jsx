// src/pages/UsersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../services/api";
import "./menu.css";

/* OJO: sin 'superadmin' en opciones del formulario */
const ROLES = [
  { value: "docente", label: "Docente" },
  { value: "admin",   label: "Admin"   },
];

const EMPTY = {
  id: null,
  username: "",
  nombre: "",
  apellidos: "",
  email: "",
  rol: "docente",
  activo: 1,
  password: "", // solo al crear
};

// --- util: decode JWT payload (sin libs)
function decodeJWT() {
  try {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return null;
    const [, payload] = token.split(".");
    const json = JSON.parse(atob(payload));
    return json; // { id, username, rol, ... }
  } catch { return null; }
}

export default function UsersPage() {
  const nav = useNavigate();
  const [users, setUsers]   = useState([]);
  const [form, setForm]     = useState(EMPTY);
  const [edit, setEdit]     = useState(false);
  const [loading, setLoad]  = useState(false);

  const me = useMemo(() => decodeJWT(), []);
  const isSuper = me?.rol === "superadmin";
  const isAdmin = me?.rol === "admin";

  const load = async () => {
    const { data } = await usersApi.list();
    setUsers(data || []);
  };
  useEffect(() => { load(); }, []);

  const startCreate = () => { setEdit(false); setForm({ ...EMPTY }); };

  const startEdit = (u) => {
    // Bloqueo: nadie edita al superadmin excepto el superadmin
    if (u.rol === "superadmin" && !isSuper) {
      alert("No puedes editar la cuenta SUPERADMIN.");
      return;
    }
    // Admin sí puede editar admins y docentes; prohibido superadmin
    setEdit(true);
    setForm({
      id: u.id,
      username: u.username ?? "",
      nombre: u.nombre ?? "",
      apellidos: u.apellidos ?? "",
      email: u.email ?? "",
      // evita mostrar 'superadmin' en el select
      rol: u.rol === "superadmin" ? "admin" : (u.rol ?? "docente"),
      activo: Number(u.activo) ? 1 : 0,
      password: "",
    });
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "activo" ? Number(value) : value }));
  };

  // ---- Permisos UI coherentes con backend
  const canToggle = (u) => {
    if (u.rol === "superadmin") return false;       // nadie toca superadmin (salvo super por backend)
    if (isAdmin && u.rol === "admin") return false; // admin no toggles a otro admin
    return true;
  };

  const canDelete = (u) => {
    if (u.rol === "superadmin") return false;       // nadie borra superadmin desde UI
    if (isAdmin && u.rol !== "docente") return false; // admin solo borra docentes
    return true;
  };

  const toggleActivo = async (u) => {
    if (!canToggle(u)) {
      alert(u.rol === "superadmin"
        ? "No puedes activar/inactivar al SUPERADMIN."
        : "Un ADMIN no puede activar/inactivar a otro ADMIN.");
      return;
    }
    await usersApi.toggleActivo(u.id); // backend hace el toggle
    await load();
  };

  const removeUser = async (u) => {
    if (!canDelete(u)) {
      alert(u.rol === "superadmin"
        ? "No puedes eliminar al SUPERADMIN."
        : "Un ADMIN solo puede eliminar DOCENTES.");
      return;
    }
    if (!confirm(`¿Eliminar a ${u.nombre || u.username}?`)) return;
    await usersApi.remove(u.id);
    await load();
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoad(true);
    try {
      if (edit) {
        await usersApi.update(form.id, {
          username: form.username,
          nombre: form.nombre,
          apellidos: form.apellidos,
          email: form.email,
          rol: form.rol, // nunca 'superadmin' desde UI
          activo: Number(form.activo) ? 1 : 0,
        });
      } else {
        if (!form.username || !form.email || !form.nombre) {
          alert("username, nombre y email son obligatorios.");
          return;
        }
        if (!form.password || form.password.length < 6) {
          alert("La contraseña inicial debe tener al menos 6 caracteres.");
          return;
        }
        await usersApi.create({
          username: form.username,
          nombre: form.nombre,
          apellidos: form.apellidos,
          email: form.email,
          rol: form.rol, // puede ser 'admin' (permitido crear admins)
          activo: Number(form.activo) ? 1 : 0,
          password: form.password,
        });
      }
      await load();
      startCreate();
    } catch (err) {
      alert(err?.response?.data?.message || err?.response?.data?.error || "Error al guardar");
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 720 }}>
        {/* Header */}
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Catálogo — Usuarios</h1>
        </div>

        {/* Lista */}
        <div className="list-container">
          {users.map((u) => {
            const isMe = me && Number(me.id) === Number(u.id);
            return (
              <div key={u.id} className="list-item">
                <div className="item-info">
                  <div className="title-row">
                    <strong>{u.nombre || u.username}</strong>
                    <span className={`pill ${u.rol}`}>{u.rol}</span>
                    <span className={`badge ${u.activo ? "ok" : "warn"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                    {isMe && <span className="pill me">Tú</span>}
                  </div>
                  <div className="sub-row">
                    <span className="muted">{u.email}</span>
                  </div>
                </div>
                <div className="item-actions">
                  <button
                    className="btn-edit"
                    onClick={() => startEdit(u)}
                    disabled={u.rol === "superadmin" && !isSuper}
                    title={(u.rol==="superadmin" && !isSuper) ? "Solo el SUPERADMIN puede editarse" : ""}
                  >
                    Editar
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => toggleActivo(u)}
                    disabled={!canToggle(u)}
                    title={!canToggle(u) ? "Sin permiso para activar/inactivar" : ""}
                  >
                    {u.activo ? "Inactivar" : "Activar"}
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => removeUser(u)}
                    disabled={!canDelete(u)}
                    title={!canDelete(u) ? "Sin permiso para eliminar" : ""}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Formulario */}
        <form onSubmit={submit} className="form-box">
          <h2>{edit ? "Editar Usuario" : "Crear Usuario"}</h2>

          <label>Nombre:</label>
          <input name="nombre" value={form.nombre} onChange={onChange} placeholder="Nombre" required />

          <label>Apellidos:</label>
          <input name="apellidos" value={form.apellidos} onChange={onChange} placeholder="Apellidos" />

          <label>Email:</label>
          <input type="email" name="email" value={form.email} onChange={onChange} placeholder="email@sal-upp.local" required />

          <label>Usuario (username):</label>
          <input name="username" value={form.username} onChange={onChange} placeholder="usuario" required />

          <label>Rol:</label>
          <select name="rol" value={form.rol} onChange={onChange}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          <label>Estado:</label>
          <select name="activo" value={form.activo} onChange={onChange}>
            <option value={1}>Activo</option>
            <option value={0}>Inactivo</option>
          </select>

          {!edit && (
            <>
              <label>Contraseña (opcional al editar):</label>
              <input type="password" name="password" value={form.password} onChange={onChange} placeholder="Mínimo 6 caracteres" />
            </>
          )}

          <div className="btn-row">
            <button type="button" className="btn-cancel" onClick={startCreate}>Cancelar</button>
            <button type="submit" className="btn-save" disabled={loading}>{edit ? "Guardar" : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
