// src/routes/users.routes.js
import { Router } from "express";
import { pool } from "../services/db.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import log from "../middlewares/bitacora.js";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";

const r = Router();

/* =========================================================
   LISTAR USUARIOS (ADMIN / SUPERADMIN)
========================================================= */
r.get("/", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id,username,nombre,apellidos,email,rol,activo
       FROM users
      WHERE eliminado=0
      ORDER BY FIELD(rol,'superadmin','admin','docente'), nombre`
  );
  res.json(rows.map(u => ({ ...u, is_me: u.id === req.user.id })));
});

/* =========================================================
   CREAR USUARIO
========================================================= */
r.post("/", requireAuth, requireRole("admin", "superadmin"), log("users"), async (req, res) => {
  const { username, nombre, apellidos = "", email, rol = "docente", activo = 1, password } = req.body;

  if (!username || !nombre || !email || !password) {
    return res.status(400).json({ error: "username, nombre, email y password son obligatorios" });
  }
  if (rol === "superadmin") {
    return res.status(403).json({ error: "Prohibido crear superadmin" });
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.execute(
    `INSERT INTO users (username,nombre,apellidos,email,rol,activo,password_hash)
     VALUES (?,?,?,?,?,?,?)`,
    [username, nombre, apellidos, email, rol, Number(activo) ? 1 : 0, hash]
  );

  res.status(201).json({ ok: true });
});

/* =========================================================
   ACTUALIZAR USUARIO
========================================================= */
r.put("/:id", requireAuth, requireRole("admin", "superadmin"), log("users"), async (req, res) => {
  const { id } = req.params;
  const { username, nombre, apellidos = "", email, rol, activo } = req.body;

  if (rol === "superadmin") {
    return res.status(403).json({ error: "No se puede asignar rol superadmin" });
  }

  const [[target]] = await pool.query(
    "SELECT id,rol FROM users WHERE id=? AND eliminado=0", [id]
  );
  if (!target) return res.status(404).json({ error: "No encontrado" });

  if (target.rol === "superadmin" && req.user.rol !== "superadmin") {
    return res.status(403).json({ error: "No puedes editar al SUPERADMIN" });
  }

  await pool.execute(
    `UPDATE users
       SET username=?, nombre=?, apellidos=?, email=?, rol=?, activo=?, updated_at=NOW()
     WHERE id=? AND eliminado=0`,
    [username, nombre, apellidos, email, rol, Number(activo) ? 1 : 0, id]
  );

  res.json({ ok: true });
});

/* =========================================================
   CAMBIAR ESTADO ACTIVO
========================================================= */
r.patch("/:id/activo", requireAuth, requireRole("admin", "superadmin"), log("users"), async (req, res) => {
  const { id } = req.params;
  const [[row]] = await pool.query(
    "SELECT id,rol,activo FROM users WHERE id=? AND eliminado=0", [id]
  );
  if (!row) return res.status(404).json({ error: "No encontrado" });

  if (row.rol === "superadmin" && req.user.rol !== "superadmin") {
    return res.status(403).json({ error: "No se puede inactivar al SUPERADMIN" });
  }
  if (req.user.rol === "admin" && row.rol === "admin") {
    return res.status(403).json({ error: "Un ADMIN no puede activar/inactivar a otro ADMIN" });
  }

  const nuevo = row.activo ? 0 : 1;
  await pool.execute("UPDATE users SET activo=?, updated_at=NOW() WHERE id=?", [nuevo, id]);

  res.json({ id: Number(id), activo: nuevo });
});

/* =========================================================
   ELIMINAR USUARIO
========================================================= */
r.delete("/:id", requireAuth, requireRole("admin", "superadmin"), log("users"), async (req, res) => {
  const { id } = req.params;
  const [[row]] = await pool.query(
    "SELECT id,rol FROM users WHERE id=? AND eliminado=0", [id]
  );
  if (!row) return res.status(404).json({ error: "No encontrado" });

  if (row.rol === "superadmin") {
    return res.status(403).json({ error: "No se puede eliminar al SUPERADMIN" });
  }

  if (req.user.rol === "admin" && row.rol !== "docente") {
    return res.status(403).json({ error: "Un ADMIN solo puede eliminar DOCENTES" });
  }

  await pool.execute(
    "UPDATE users SET eliminado=1, eliminado_en=NOW(), activo=0 WHERE id=?", [id]
  );

  res.json({ ok: true });
});

/* =========================================================
   SUBIR AVATAR (NUEVO — FUNCIONAL)
========================================================= */

// Asegurar carpeta uploads/avatars/
const avatarDir = path.resolve("uploads/avatars");
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
  console.log("📁 Carpeta creada:", avatarDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.params.id}${ext}`);
  }
});

const upload = multer({ storage });

r.post("/:id/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se envió archivo" });
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    await pool.execute(
      "UPDATE users SET avatar_url=?, updated_at=NOW() WHERE id=?",
      [avatarPath, req.params.id]
    );

    res.json({ ok: true, avatar_url: avatarPath });
  } catch (err) {
    console.error("❌ Error subiendo avatar:", err);
    res.status(500).json({ error: "Error interno al subir avatar" });
  }
});

/* ========================================================= */

export default r;
