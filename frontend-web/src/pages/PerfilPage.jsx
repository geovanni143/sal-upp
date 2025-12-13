import { useEffect, useState } from "react";
import api from "../services/api";  // ← IMPORT CORRECTO
import "./perfil.css";

export default function PerfilPage() {
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

  // ============================================================
  // CARGAR PERFIL DEL USUARIO (ADMIN O DOCENTE)
  // ============================================================
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
        console.error(err);
        alert("Error interno del servidor");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ============================================================
  // SUBIR AVATAR
  // ============================================================
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

  // ============================================================
  // GUARDAR CAMBIOS DEL PERFIL
  // ============================================================
  const actualizarPerfil = async () => {
    try {
      const r = await api.put("/me", form);
      alert(r.data.mensaje);

      const newData = await api.get("/me");
      setData(newData.data);

      setEditOpen(false);
    } catch (err) {
      alert(err.response?.data?.error || "Error actualizando perfil");
    }
  };

  if (loading) return <p style={{ padding: "20px" }}>Cargando perfil...</p>;
  if (!data) return <p>Error cargando datos del usuario</p>;

  const avatarURL =
    avatarPreview ||
    data.avatar_url ||
    "/default-avatar.png";

  return (
    <div className="perfil-container">
      <h1 className="perfil-titulo">SAL-UPP</h1>
      <p className="perfil-rol">{data.rol}</p>

      <h2 className="perfil-subtitulo">Mi perfil</h2>

      <div className="perfil-avatar-container">
        <img className="perfil-avatar-img" src={avatarURL} alt="avatar" />

        <label className="perfil-avatar-input">
          Cambiar foto
          <input type="file" accept="image/*" onChange={subirAvatar} />
        </label>
      </div>

      <div className="perfil-info">
        <p><strong>Nombre:</strong> {data.nombre} {data.apellidos}</p>
        <p><strong>Correo:</strong> {data.email}</p>
        <p><strong>Usuario:</strong> {data.username}</p>
        <p><strong>Rol:</strong> {data.rol}</p>
        <p><strong>Contraseña:</strong> *****</p>
      </div>

      <button className="perfil-boton" onClick={() => setEditOpen(true)}>
        Editar datos
      </button>

      <button
        className="perfil-boton-secundario"
        onClick={() => (window.location.href = data.rol === "admin" ? "/admin" : "/docente")}
      >
        Regresar al menú
      </button>

      {/* =====================
          MODAL
      ===================== */}
      {editOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Editar perfil</h3>

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
