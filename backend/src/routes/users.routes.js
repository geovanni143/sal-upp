// backend/src/routes/users.routes.js
import { Router } from "express";
import { pool } from "../services/db.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import log from "../middlewares/bitacora.js";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";

const r = Router();

/* =====================================================
   1) PERFIL — OBTENER USUARIO POR ID
===================================================== */
r.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [[user]] = await pool.query(
      `SELECT 
         id,
         username, nombre, apellidos, email, rol, activo, avatar_url
       FROM users
       WHERE id = ? AND eliminado = 0
       LIMIT 1`,
      [id]
    );

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    console.error("ERROR GET /users/:id", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =====================================================
   2) LISTAR USUARIOS
===================================================== */
r.get("/", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         id,
         username, nombre, apellidos, email, rol, activo, avatar_url
       FROM users
       WHERE eliminado = 0
       ORDER BY FIELD(rol,'superadmin','admin','docente'), nombre`
    );

    res.json(
      rows.map((u) => ({
        ...u,
        is_me: u.id === req.user.id,
      }))
    );
  } catch (err) {
    console.error("ERROR GET /users", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =====================================================
   3) CREAR USUARIO
===================================================== */
r.post(
  "/",
  requireAuth,
  requireRole("admin", "superadmin"),
  log("users"),
  async (req, res) => {
    try {
      const { username, nombre, apellidos = "", email, rol = "docente", activo = 1, password } = req.body;

      if (!username || !nombre || !email || !password) {
        return res.status(400).json({ error: "Campos obligatorios faltantes" });
      }

      if (rol === "superadmin") {
        return res.status(403).json({ error: "Prohibido crear superadmin" });
      }

      const [[exists]] = await pool.query(
        `SELECT id FROM users WHERE (username=? OR email=?) AND eliminado=0 LIMIT 1`,
        [username, email]
      );

      if (exists) {
        return res.status(409).json({ error: "Usuario o email ya existe" });
      }

      const hash = await bcrypt.hash(password, 10);

      await pool.execute(
        `INSERT INTO users 
         (username, nombre, apellidos, email, rol, activo, password_hash)
         VALUES (?,?,?,?,?,?,?)`,
        [username, nombre, apellidos, email, rol, Number(activo), hash]
      );

      res.status(201).json({ ok: true });
    } catch (err) {
      console.error("ERROR POST /users", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

/* =====================================================
   4) EDITAR USUARIO
===================================================== */
r.put("/:id", requireAuth, requireRole("admin", "superadmin"), log("users"), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, nombre, apellidos = "", email, rol, activo } = req.body;

    const [[target]] = await pool.query(
      "SELECT id, rol FROM users WHERE id=? AND eliminado=0",
      [id]
    );

    if (!target) return res.status(404).json({ error: "No encontrado" });

    const [[dupe]] = await pool.query(
      `SELECT id FROM users WHERE (username=? OR email=?) AND eliminado=0 AND id<>? LIMIT 1`,
      [username, email, id]
    );

    if (dupe) {
      return res.status(409).json({ error: "Duplicado" });
    }

    await pool.execute(
      `UPDATE users
       SET username=?, nombre=?, apellidos=?, email=?, rol=?, activo=?, updated_at=NOW()
       WHERE id=?`,
      [username, nombre, apellidos, email, rol, Number(activo), id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("ERROR PUT /users/:id", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =====================================================
   5) ACTIVAR / INACTIVAR
===================================================== */
r.patch("/:id/activo", requireAuth, requireRole("admin", "superadmin"), log("users"), async (req, res) => {
  try {
    const { id } = req.params;

    const [[row]] = await pool.query(
      "SELECT id, rol, activo FROM users WHERE id=? AND eliminado=0",
      [id]
    );

    if (!row) return res.status(404).json({ error: "No encontrado" });

    const nuevo = row.activo ? 0 : 1;

    await pool.execute(
      "UPDATE users SET activo=?, updated_at=NOW() WHERE id=?",
      [nuevo, id]
    );

    res.json({ id: Number(id), activo: nuevo });
  } catch (err) {
    console.error("ERROR PATCH /users/:id/activo", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =====================================================
   6) ELIMINAR (SOFT DELETE)
===================================================== */
r.delete("/:id", requireAuth, requireRole("admin", "superadmin"), log("users"), async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      "UPDATE users SET eliminado=1, eliminado_en=NOW(), activo=0 WHERE id=?",
      [id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("ERROR DELETE /users/:id", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =====================================================
   7) AVATAR
===================================================== */
const avatarDir = path.resolve("uploads/avatars");
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.params.id}${ext}`);
  },
});
const upload = multer({ storage });

r.post("/:id/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    await pool.execute(
      "UPDATE users SET avatar_url=?, updated_at=NOW() WHERE id=?",
      [avatarPath, req.params.id]
    );

    res.json({ ok: true, avatar_url: avatarPath });
  } catch (err) {
    console.error("Error avatar:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default r;
