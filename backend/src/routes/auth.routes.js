// backend/src/routes/auth.routes.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { pool } from "../db/mysql.js";

const r = Router();

// 🔐 POST /api/login
r.post("/login", async (req, res) => {
  try {
    const b = req.body || {};
    // Acepta distintos nombres de campos
    const rawUser = b.user ?? b.username ?? b.email ?? b.correo ?? "";
    const password = b.password ?? b.pass ?? b.contra ?? "";

    // Validación de campos requeridos
    if (!rawUser || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    // Buscar usuario por username (tu tabla lo usa así)
    const [rows] = await pool.query(
      "SELECT id, username, nombre, email, role, activo, password_hash FROM users WHERE username = ? LIMIT 1",
      [rawUser]
    );

    if (!rows.length) {
      return res
        .status(401)
        .json({ error: "Usuario o contraseña incorrectos" });
    }

    const u = rows[0];

    // Si el usuario está inactivo
    if (!u.activo) {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    // Verificar contraseña con bcrypt
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      return res
        .status(401)
        .json({ error: "Usuario o contraseña incorrectos" });
    }

    // Generar token JWT
    const token = jwt.sign(
      { sub: u.id, username: u.username, role: u.role },
      process.env.JWT_SECRET || "dev_key",
      { expiresIn: `${process.env.JWT_EXP_MIN || 120}m` }
    );

    // Responder al frontend
    res.json({
      token,
      user: {
        id: u.id,
        nombre: u.nombre,
        username: u.username,
        email: u.email,
        role: u.role,
      },
    });
  } catch (e) {
    console.error("[LOGIN ERROR]", e);
    res.status(500).json({ error: "Error de autenticación" });
  }
});

export default r;
