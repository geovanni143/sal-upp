// src/pages/UsersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../services/api";
import { getUser, getToken, getRole } from "../state/auth";
import "./menu.css";

/* OJO: sin 'superadmin' en opciones del formulario */
const ROLES = [
  { value: "docente", label: "Docente" },
  { value: "admin", label: "Admin" },
];

const EMPTY = {
  id: null,
  username: "",
  nombre: "",
  apellidos: "",
  email: "",
  rol: "docente",
  activo: 1,
  password: "",
  password2: "",
};

// ---------- helpers JWT (base64url) ----------
function base64UrlDecode(str) {
  try {
    if (!str) return null;
    const pad = "=".repeat((4 - (str.length % 4)) % 4);
    const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    return decoded;
  } catch {
    return null;
  }
}

function decodeJWT() {
  try {
    const token = getToken();
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = base64UrlDecode(parts[1]);
    if (!payload) return null;
    return JSON.parse(payload); // { id, username, rol, ... }
  } catch {
    return null;
  }
}

export default function UsersPage() {
  const nav = useNavigate();

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [edit, setEdit] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mostrar/ocultar contraseña en crear
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  // "me" preferentemente desde user guardado; fallback decode JWT
  const meUser = useMemo(() => getUser(), []);
  const meJwt = useMemo(() => decodeJWT(), []);
  const me = meUser || meJwt || null;

  const myId = me?.id ? Number(me.id) : null;
  const myRol = (me?.rol || me?.role || getRole() || "").toString();

  const isSuper = myRol === "superadmin";
  const isAdmin = myRol === "admin";

  const load = async () => {
    const { data } = await usersApi.list();
    setUsers(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEdit(false);
    setForm({ ...EMPTY });
    setShowPass1(false);
    setShowPass2(false);
  };

  const startEdit = (u) => {
    // Bloqueo: nadie edita al superadmin excepto el superadmin
    if (u.rol === "superadmin" && !isSuper) {
      alert("No puedes editar la cuenta SUPERADMIN.");
      return;
    }

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
      password2: "",
    });

    setShowPass1(false);
    setShowPass2(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "activo" ? Number(value) : value }));
  };

  // ---- Permisos UI coherentes con backend
  const canToggle = (u) => {
    if (u.rol === "superadmin") return false;       // nadie toca superadmin
    if (isAdmin && u.rol === "admin") return false; // admin no toggles a otro admin
    return true;
  };

  const canDelete = (u) => {
    if (u.rol === "superadmin") return false;          // nadie borra superadmin
    if (isAdmin && u.rol !== "docente") return false;  // admin solo borra docentes
    return true;
  };

  const toggleActivo = async (u) => {
    if (!canToggle(u)) {
      alert(
        u.rol === "superadmin"
          ? "No puedes activar/inactivar al SUPERADMIN."
          : "Un ADMIN no puede activar/inactivar a otro ADMIN."
      );
      return;
    }
    await usersApi.toggleActivo(u.id);
    await load();
  };

  const removeUser = async (u) => {
    if (!canDelete(u)) {
      alert(
        u.rol === "superadmin"
          ? "No puedes eliminar al SUPERADMIN."
          : "Un ADMIN solo puede eliminar DOCENTES."
      );
      return;
    }
    if (!confirm(`¿Eliminar a ${u.nombre || u.username}?`)) return;
    await usersApi.remove(u.id);
    await load();
  };

  const validateCreatePasswords = () => {
    const p1 = (form.password || "").trim();
    const p2 = (form.password2 || "").trim();

    if (!p1 || p1.length < 6) {
      alert("La contraseña inicial debe tener al menos 6 caracteres.");
      return false;
    }
    if (p1 !== p2) {
      alert("La contraseña y la confirmación no coinciden.");
      return false;
    }
    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

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
        // Crear
        if (!form.username || !form.email || !form.nombre) {
          alert("username, nombre y email son obligatorios.");
          return;
        }
        if (!validateCreatePasswords()) return;

        await usersApi.create({
          username: form.username,
          nombre: form.nombre,
          apellidos: form.apellidos,
          email: form.email,
          rol: form.rol,
          activo: Number(form.activo) ? 1 : 0,
          password: form.password.trim(),
        });
      }

      await load();
      startCreate();
    } catch (err) {
      alert(err?.response?.data?.message || err?.response?.data?.error || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  // ---------- lista con "Tú" hasta arriba ----------
  const listSorted = useMemo(() => {
    const copy = [...users];
    if (!myId) return copy;

    copy.sort((a, b) => {
      const aMe = Number(a.id) === myId ? 0 : 1;
      const bMe = Number(b.id) === myId ? 0 : 1;
      if (aMe !== bMe) return aMe - bMe; // "yo" primero
      // si no soy yo, deja el orden natural por nombre
      const an = (a.nombre || a.username || "").toLowerCase();
      const bn = (b.nombre || b.username || "").toLowerCase();
      return an.localeCompare(bn);
    });

    return copy;
  }, [users, myId]);

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 720 }}>
        {/* Header */}
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Catálogo — Usuarios</h1>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => nav(myRol.startsWith("admin") ? "/admin/perfil" : "/docente/perfil")}
            title="Ir a mi perfil"
          >
            Mi perfil
          </button>
        </div>

        {/* Lista */}
        <div className="list-container">
          {listSorted.map((u) => {
            const isMe = myId && Number(u.id) === myId;

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
                    title={(u.rol === "superadmin" && !isSuper) ? "Solo el SUPERADMIN puede editarse" : ""}
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
          <input
            name="nombre"
            value={form.nombre}
            onChange={onChange}
            placeholder="Nombre"
            required
          />

          <label>Apellidos:</label>
          <input
            name="apellidos"
            value={form.apellidos}
            onChange={onChange}
            placeholder="Apellidos"
          />

          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="email@sal-upp.local"
            required
          />

          <label>Usuario (username):</label>
          <input
            name="username"
            value={form.username}
            onChange={onChange}
            placeholder="usuario"
            required
          />

          <label>Rol:</label>
          <select name="rol" value={form.rol} onChange={onChange}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <label>Estado:</label>
          <select name="activo" value={form.activo} onChange={onChange}>
            <option value={1}>Activo</option>
            <option value={0}>Inactivo</option>
          </select>

          {/* SOLO AL CREAR: password + confirm + ojito */}
          {!edit && (
            <>
              <label>Contraseña:</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass1 ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass1((s) => !s)}
                  className="btn icon"
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "6px 10px",
                  }}
                  title={showPass1 ? "Ocultar" : "Ver"}
                >
                  {showPass1 ? "🙈" : "👁"}
                </button>
              </div>

              <label>Confirmar contraseña:</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass2 ? "text" : "password"}
                  name="password2"
                  value={form.password2}
                  onChange={onChange}
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass2((s) => !s)}
                  className="btn icon"
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "6px 10px",
                  }}
                  title={showPass2 ? "Ocultar" : "Ver"}
                >
                  {showPass2 ? "🙈" : "👁"}
                </button>
              </div>
            </>
          )}

          <div className="btn-row">
            <button type="button" className="btn-cancel" onClick={startCreate}>
              Cancelar
            </button>
            <button type="submit" className="btn-save" disabled={loading}>
              {edit ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
