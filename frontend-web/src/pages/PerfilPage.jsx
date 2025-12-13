import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./perfil.css";

const API_BASE = import.meta.env.VITE_API_URL.replace("/api", "");

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

  /* ================= CARGAR PERFIL ================= */
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/me");
        setData(r.data);
        setForm((f) => ({
          ...f,
          nombre: r.data.nombre || "",
          apellidos: r.data.apellidos || "",
          email: r.data.email || "",
          username: r.data.username || "",
        }));
      } catch (err) {
        console.error(err);
        alert("Error cargando perfil");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ================= AVATAR ================= */
  const subirAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file || !data) return;

    setAvatarPreview(URL.createObjectURL(file));

    const fd = new FormData();
    fd.append("avatar", file);

    try {
      await api.post(`/users/${data.id}/avatar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const r = await api.get("/me");
      setData(r.data);
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
    // Validar contraseñas nuevas
    if (form.password && form.password !== form.confirmPassword) {
      alert("❌ Las contraseñas no coinciden");
      return;
    }

    try {
      const payload = {
        nombre: form.nombre,
        apellidos: form.apellidos,
        email: form.email,
        username: form.username,
      };

      if (form.password) {
        payload.password = form.password;
      }

      await api.put("/me", payload);
      const r = await api.get("/me");
      setData(r.data);

      // Limpiar campos de contraseña después de guardar
      setForm((f) => ({ ...f, password: "", confirmPassword: "" }));
      setShowNewPass(false);
      setShowConfirmPass(false);
      setEditOpen(false);
      alert("Perfil actualizado correctamente");
    } catch (err) {
      console.error(err);
      alert("Error actualizando perfil");
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
              onChange={(e) =>
                setForm({ ...form, nombre: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Apellidos"
              value={form.apellidos}
              onChange={(e) =>
                setForm({ ...form, apellidos: e.target.value })
              }
            />

            <input
              type="email"
              placeholder="Correo"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Usuario"
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
            />

            {/* NUEVA CONTRASEÑA */}
            <div className="pass-row">
              <input
                type={showNewPass ? "text" : "password"}
                placeholder="Nueva contraseña"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
              >
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
