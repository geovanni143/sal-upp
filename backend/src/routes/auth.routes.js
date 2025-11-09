// backend/src/routes/auth.routes.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../services/db.js";
import bcrypt from "bcrypt";

const r = Router();

r.post("/login", async (req, res) => {
  try {
    const b = req.body || {};
    const rawUser = b.user ?? b.username ?? b.email ?? "";
    const password = b.password ?? "";

    if (!rawUser || !password) return res.status(400).json({ error: "Faltan credenciales" });

    const [rows] = await pool.query(
      `SELECT id, username, nombre, apellidos, email, rol, activo, password_hash
       FROM users
       WHERE eliminado=0 AND (username=? OR email=?)
       LIMIT 1`,
      [rawUser, rawUser]
    );
    if (!rows.length) return res.status(401).json({ error: "Usuario o contraseña inválidos" });

    const u = rows[0];

    // Inactivo NO entra, salvo superadmin
    if (!u.activo && u.rol !== "superadmin") {
      return res.status(403).json({ error: "Cuenta inactiva. Contacta al administrador." });
    }

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "Usuario o contraseña inválidos" });

    const token = jwt.sign(
      { id: u.id, username: u.username, rol: u.rol },
      process.env.JWT_SECRET || "secretito",
      { expiresIn: process.env.JWT_EXP || "8h" }
    );

    res.json({
      token,
      user: {
        id: u.id,
        username: u.username,
        nombre: u.nombre,
        apellidos: u.apellidos,
        email: u.email,
        rol: u.rol,
        activo: u.activo,
      },
    });
  } catch (e) {
    console.error("[LOGIN ERROR]", e);
    res.status(500).json({ error: "Error de autenticación" });
  }
});

export default r;
