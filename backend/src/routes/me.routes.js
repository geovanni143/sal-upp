import { Router } from "express";
import { pool } from "../services/db.js";
import { requireAuth } from "../middlewares/auth.js";
import bcrypt from "bcryptjs";

const r = Router();

/* =========================================================
   GET /api/me  → Datos del usuario logueado
========================================================= */
r.get("/", requireAuth, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      `SELECT id, username, nombre, apellidos, email, rol, avatar_url, activo
       FROM users
       WHERE id=? LIMIT 1`,
      [req.user.sub]
    );

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);

  } catch (e) {
    console.error("❌ /api/me error:", e);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


/* =========================================================
   PUT /api/me  → El DOCENTE actualiza sus propios datos
========================================================= */
r.put("/", requireAuth, async (req, res) => {
  try {
    const { nombre, apellidos, email, username, password } = req.body;

    // Validación
    if (!nombre || !email || !username) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // Si mandó nueva contraseña, generamos hash
    let updatePassword = "";
    let params = [nombre, apellidos, email, username];

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      updatePassword = ", password_hash=?";
      params.push(hash);
    }

    params.push(req.user.sub);

    await pool.execute(
      `UPDATE users 
       SET nombre=?, apellidos=?, email=?, username=? ${updatePassword}
       WHERE id=?`,
      params
    );

    res.json({ ok: true });

  } catch (e) {
    console.error("❌ Error en PUT /api/me:", e);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default r;
