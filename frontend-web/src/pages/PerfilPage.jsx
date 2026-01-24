import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { getUser, getToken, saveSession, clearSession } from "../state/auth";
import "./perfil.css";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

// helpers JWT base64url (fallback)
function base64UrlDecode(str) {
  try {
    const pad = "=".repeat((4 - (str.length % 4)) % 4);
    const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
    return atob(base64);
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
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export default function PerfilPage() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    apellidos: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  // ver / ocultar SOLO lo que el usuario escribe
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // id del usuario loggeado (fallback si /me no existe)
  const myId = useMemo(() => {
    const u = getUser();
    if (u?.id) return Number(u.id);
    const j = decodeJWT();
    if (j?.id) return Number(j.id);
    return null;
  }, []);

  const setProfileState = (profile) => {
    setData(profile);
    setForm((f) => ({
      ...f,
      nombre: profile?.nombre || "",
      apellidos: profile?.apellidos || "",
      email: profile?.email || "",
      username: profile?.username || "",
      password: "",
      confirmPassword: "",
    }));
  };

  /* ================= CARGAR PERFIL (ROBUSTO) ================= */
  const fetchMe = async () => {
    // si no hay token, fuera
    if (!getToken()) {
      clearSession();
      navigate("/login", { replace: true });
      return;
    }

    // 1) intenta /me (tu ruta actual)
    try {
      const r = await api.get("/me");
      setProfileState(r.data);
      return;
    } catch (err) {
      // si /me no existe o falla, hacemos fallback
      const status = err?.response?.status;
      if (status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return;
      }
      // continúa al fallback
    }

    // 2) fallback: /users/:id
    if (!myId) {
      clearSession();
      navigate("/login", { replace: true });
      return;
    }

    try {
      const r2 = await api.get(`/users/${myId}`);
      setProfileState(r2.data);
    } catch (err2) {
      console.error(err2);
      const status2 = err2?.response?.status;
      if (status2 === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return;
      }
      alert("Error cargando perfil");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchMe();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= AVATAR ================= */
  const subirAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;

    setAvatarPreview(URL.createObjectURL(file));

    const fd = new FormData();
    fd.append("avatar", file);

    try {
      await api.post(`/users/${data.id}/avatar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await fetchMe();
      alert("Avatar actualizado");
    } catch (err) {
      console.error(err);
      alert("Error subiendo avatar");
    } finally {
      setAvatarPreview(null);
    }
  };

  /* ================= GUARDAR PERFIL ================= */
  const actualizarPerfil = async () => {
    // Validación: si escribe pass, deben coincidir y mínimo 6
    const p1 = (form.password || "").trim();
    const p2 = (form.confirmPassword || "").trim();

    if (p1) {
      if (p1.length < 6) {
        alert("❌ La nueva contraseña debe tener al menos 6 caracteres");
        return;
      }
      if (p1 !== p2) {
        alert("❌ Las contraseñas no coinciden");
        return;
      }
    }

    try {
      const payload = {
        nombre: form.nombre,
        apellidos: form.apellidos,
        email: form.email,
        username: form.username,
      };

      if (p1) payload.password = p1;

      // 1) intenta actualizar por /me (tu ruta)
      try {
        await api.put("/me", payload);
      } catch (err) {
        // fallback a /users/:id si no existe /me
        if (!data?.id) throw err;
        await api.put(`/users/${data.id}`, payload);
      }

      // recargar datos reales
      await fetchMe();

      // actualizar user en storage (para que todo el sistema refleje tus cambios)
      // mantiene el token actual
      const token = getToken();
      const current = getUser() || {};
      saveSession({ token, user: { ...current, ...payload, id: data?.id, rol: data?.rol } }, { remember: true });

      // Limpiar campos de contraseña
      setForm((f) => ({ ...f, password: "", confirmPassword: "" }));
      setShowNewPass(false);
      setShowConfirmPass(false);
      setEditOpen(false);
      alert("Perfil actualizado correctamente");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || "Error actualizando perfil");
    }
  };

  /* ================= REGRESAR SEGÚN ROL ================= */
  const regresarMenu = () => {
    if (!data) return;
    if (["admin", "admin_lab", "superadmin"].includes(data.rol)) {
      navigate("/admin");
    } else {
      navigate("/docente");
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Cargando…</p>;
  if (!data) return <p>Error cargando perfil</p>;

  // Avatar
  let avatar = data.avatar_url;
  if (avatar?.startsWith("/uploads")) avatar = API_BASE + avatar;
  const avatarURL = avatarPreview || avatar || "/default-avatar.png";

  return (
    <div className="perfil-page-shell">
      <div className="perfil-shell">
        <h1 className="perfil-titulo">SAL-UPP</h1>
        <p className="perfil-rol">{data.rol}</p>
        <h2 className="perfil-subtitulo">Mi perfil</h2>

        {/* AVATAR */}
        <div className="perfil-avatar-container">
          <img src={avatarURL} className="perfil-avatar-img" alt="Avatar" />
          <br />

          <label className="perfil-avatar-input">
            Cambiar foto
            <input type="file" accept="image/*" onChange={subirAvatar} />
          </label>
        </div>

        {/* INFO */}
        <div className="perfil-info">
          <p>
            <strong>Nombre:</strong> {data.nombre} {data.apellidos}
          </p>
          <p>
            <strong>Correo:</strong> {data.email}
          </p>
          <p>
            <strong>Usuario:</strong> {data.username}
          </p>
          <p>
            <strong>Rol:</strong> {data.rol}
          </p>
          <p>
            <strong>Contraseña:</strong> ••••••••
          </p>
        </div>

        <button className="perfil-boton" onClick={() => setEditOpen(true)}>
          Editar datos
        </button>

        <button className="perfil-boton-secundario" onClick={regresarMenu}>
          Regresar al menú
        </button>
      </div>

      {/* =============== MODAL =============== */}
      {editOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">Editar perfil</h3>

            <input
              type="text"
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />

            <input
              type="text"
              placeholder="Apellidos"
              value={form.apellidos}
              onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
            />

            <input
              type="email"
              placeholder="Correo"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              type="text"
              placeholder="Usuario"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />

            {/* NUEVA CONTRASEÑA */}
            <div className="pass-row">
              <input
                type={showNewPass ? "text" : "password"}
                placeholder="Nueva contraseña"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowNewPass(!showNewPass)}>
                {showNewPass ? "Ocultar" : "Ver"}
              </button>
            </div>

            {/* CONFIRMAR CONTRASEÑA */}
            <div className="pass-row">
              <input
                type={showConfirmPass ? "text" : "password"}
                placeholder="Confirmar contraseña"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
              >
                {showConfirmPass ? "Ocultar" : "Ver"}
              </button>
            </div>

            <div className="modal-buttons">
              <button
                type="button"
                className="btn-cancelar"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-guardar"
                onClick={actualizarPerfil}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
