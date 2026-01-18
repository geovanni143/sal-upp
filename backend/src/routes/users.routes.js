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
   OJO: user_id es la PK real, lo devolvemos como id
===================================================== */
r.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [[user]] = await pool.query(
      `SELECT 
         user_id AS id,
         username, nombre, apellidos, email, rol, activo, avatar_url
       FROM users
       WHERE user_id = ? AND eliminado = 0
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
   2) LISTAR USUARIOS (ADMIN / SUPERADMIN)
===================================================== */
r.get("/", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         user_id AS id,
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
      const {
        username,
        nombre,
        apellidos = "",
        email,
        rol = "docente",
        activo = 1,
        password,
      } = req.body;

      if (!username || !nombre || !email || !password) {
        return res.status(400).json({
          error: "username, nombre, email y password son obligatorios",
        });
      }

      if (rol === "superadmin") {
        return res.status(403).json({ error: "Prohibido crear superadmin" });
      }

      const [[exists]] = await pool.query(
        `SELECT user_id FROM users WHERE (username=? OR email=?) AND eliminado=0 LIMIT 1`,
        [username, email]
      );

      if (exists) {
        return res.status(409).json({
          error: "Ya existe un usuario con ese username o email",
        });
      }

      const hash = await bcrypt.hash(password, 10);

      await pool.execute(
        `INSERT INTO users 
         (username, nombre, apellidos, email, rol, activo, password_hash)
         VALUES (?,?,?,?,?,?,?)`,
        [username, nombre, apellidos, email, rol, Number(activo) ? 1 : 0, hash]
      );

      res.status(201).json({ ok: true });
    } catch (err) {
      console.error("ERROR POST /users", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

/* =====================================================
   4) EDITAR USUARIO (POR user_id)
===================================================== */
r.put(
  "/:id",
  requireAuth,
  requireRole("admin", "superadmin"),
  log("users"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { username, nombre, apellidos = "", email, rol, activo } = req.body;

      if (rol === "superadmin") {
        return res.status(403).json({ error: "No se puede asignar rol superadmin" });
      }

      const [[target]] = await pool.query(
        "SELECT user_id, rol FROM users WHERE user_id=? AND eliminado=0",
        [id]
      );

      if (!target) return res.status(404).json({ error: "No encontrado" });

      if (target.rol === "superadmin" && req.user.rol !== "superadmin") {
        return res.status(403).json({ error: "No puedes editar al SUPERADMIN" });
      }

      const [[dupe]] = await pool.query(
        `SELECT user_id FROM users 
         WHERE (username=? OR email=?) AND eliminado=0 AND user_id<>?
         LIMIT 1`,
        [username, email, id]
      );

      if (dupe) {
        return res.status(409).json({
          error: "Ya existe otro usuario con ese username o email",
        });
      }

      await pool.execute(
        `UPDATE users
         SET username=?, nombre=?, apellidos=?, email=?, rol=?, activo=?, updated_at=NOW()
         WHERE user_id=? AND eliminado=0`,
        [username, nombre, apellidos, email, rol, Number(activo) ? 1 : 0, id]
      );

      res.json({ ok: true });
    } catch (err) {
      console.error("ERROR PUT /users/:id", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

/* =====================================================
   5) ACTIVAR / INACTIVAR (POR user_id)
===================================================== */
r.patch(
  "/:id/activo",
  requireAuth,
  requireRole("admin", "superadmin"),
  log("users"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const [[row]] = await pool.query(
        "SELECT user_id, rol, activo FROM users WHERE user_id=? AND eliminado=0",
        [id]
      );

      if (!row) return res.status(404).json({ error: "No encontrado" });

      if (row.rol === "superadmin" && req.user.rol !== "superadmin") {
        return res.status(403).json({ error: "No se puede inactivar al SUPERADMIN" });
      }

      if (req.user.rol === "admin" && row.rol === "admin") {
        return res.status(403).json({ error: "Un ADMIN no puede activar/inactivar a otro ADMIN" });
      }

      const nuevo = row.activo ? 0 : 1;

      await pool.execute(
        "UPDATE users SET activo=?, updated_at=NOW() WHERE user_id=?",
        [nuevo, id]
      );

      res.json({ id: Number(id), activo: nuevo });
    } catch (err) {
      console.error("ERROR PATCH /users/:id/activo", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

/* =====================================================
   6) ELIMINAR (SOFT DELETE) (POR user_id)
===================================================== */
r.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "superadmin"),
  log("users"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const [[row]] = await pool.query(
        "SELECT user_id, rol FROM users WHERE user_id=? AND eliminado=0",
        [id]
      );

      if (!row) return res.status(404).json({ error: "No encontrado" });

      if (row.rol === "superadmin") {
        return res.status(403).json({ error: "No se puede eliminar al SUPERADMIN" });
      }

      if (req.user.rol === "admin" && row.rol !== "docente") {
        return res.status(403).json({ error: "Un ADMIN solo puede eliminar DOCENTES" });
      }

      await pool.execute(
        "UPDATE users SET eliminado=1, eliminado_en=NOW(), activo=0 WHERE user_id=?",
        [id]
      );

      res.json({ ok: true });
    } catch (err) {
      console.error("ERROR DELETE /users/:id", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

/* =====================================================
   7) SUBIR AVATAR (POR user_id)
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
    if (!req.file) return res.status(400).json({ error: "No se envió archivo" });

    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    await pool.execute(
      "UPDATE users SET avatar_url=?, updated_at=NOW() WHERE user_id=?",
      [avatarPath, req.params.id]
    );

    res.json({ ok: true, avatar_url: avatarPath });
  } catch (err) {
    console.error("Error subiendo avatar:", err);
    res.status(500).json({ error: "Error interno al subir avatar" });
  }
});

export default r;
