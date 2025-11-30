import { useEffect, useState } from "react";
import api from "../../services/api";
import "./docente.css";

const API_BASE = import.meta.env.VITE_API_URL.replace("/api", "");

export default function Perfil() {
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
  });

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get("/me");
        setData(r.data);

        setForm({
          nombre: r.data.nombre,
          apellidos: r.data.apellidos,
          email: r.data.email,
          username: r.data.username,
          password: "",
        });
      } catch (err) {
        alert("Error interno del servidor");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ========================
        SUBIR AVATAR
  ========================*/
  const subirAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));

    const fd = new FormData();
    fd.append("avatar", file);

    try {
      await api.post(`/users/${data.id}/avatar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Avatar actualizado correctamente");
      const r = await api.get("/me");
      setData(r.data);
      setAvatarPreview(null);
    } catch (err) {
      console.error(err);
      alert("Error al subir avatar");
    }
  };

  // ==============================
  //   GUARDAR CAMBIOS DEL PERFIL
  // ==============================
  const actualizarPerfil = async () => {
    try {
      const r = await api.put("/me", form);
      alert(r.data.mensaje);

      const updated = await api.get("/me");
      setData(updated.data);

      setEditOpen(false);
    } catch (err) {
      alert(err.response?.data?.error || "Error actualizando perfil");
    }
  };

  if (loading) return <p style={{ padding: "20px" }}>Cargando...</p>;
  if (!data) return <p>Error cargando perfil</p>;

  let realAvatar = data.avatar_url;
  if (realAvatar && realAvatar.startsWith("/uploads")) {
    realAvatar = API_BASE + realAvatar;
  }
  const avatarURL = avatarPreview || realAvatar || "/default-avatar.png";

  return (
    <div className="perfil-container">
      <h1 className="perfil-titulo">SAL-UPP</h1>
      <p className="perfil-rol">Docente</p>

      <h2 className="perfil-subtitulo">Perfil Docente</h2>

      <div className="perfil-avatar-container">
        <img className="perfil-avatar-img" src={avatarURL} alt="avatar" />

<h2 className="perfil-subtitulo"></h2>
        <label className="perfil-avatar-input">
          Cambiar foto
          <input type="file" accept="image/*" onChange={subirAvatar} />
        </label>
      </div>

      {/* Datos del usuario */}
      <div className="perfil-info">
        <p><strong>Nombre:</strong> {data.nombre} {data.apellidos}</p>
        <p><strong>Correo electrónico:</strong> {data.email}</p>
        <p><strong>Usuario:</strong> {data.username}</p>
        <p><strong>Rol:</strong> {data.rol}</p>
        <p><strong>Contraseña:</strong> *****</p>
      </div>

      <button className="perfil-boton" onClick={() => setEditOpen(true)}>
        Cambiar datos
      </button>

      <button
  className="perfil-boton-secundario"
  onClick={() => (window.location.href = "/docente")}
>
  Regresar al menú
</button>

      {/* ====================
          MODAL DE EDICIÓN
      ==================== */}
      {editOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Editar Perfil</h3>

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

            <input
              type="password"
              placeholder="Nueva contraseña (opcional)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            <div className="modal-buttons">
              <button onClick={() => setEditOpen(false)}>Cancelar</button>
              <button onClick={actualizarPerfil}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
