// backend/src/routes/auth.routes.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "../services/db.js";

const r = Router();

// POST /api/login
r.post("/login", async (req, res) => {
  console.log("LOGIN BODY:", req.body);
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    // Permitir login por username o email REAL
let email = username.trim().toLowerCase();

if (!email.includes("@")) {
  // Buscar al usuario por username real
  const [[u]] = await pool.query(
    "SELECT email FROM users WHERE username=? LIMIT 1",
    [email]
  );
  if (!u) return res.status(401).json({ error: "Usuario no existe" });
  email = u.email;
}


    const [[user]] = await pool.query(
      "SELECT id, username, nombre, apellidos, email, rol, password_hash, activo FROM users WHERE email=? AND eliminado=0 LIMIT 1",
      [email]
    );

    if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    if (!user.activo) return res.status(403).json({ error: "Usuario inactivo" });

    // 🔥 Comparación real con bcrypt
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

    // Crear token
    const token = jwt.sign(
      { sub: user.id, email: user.email, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellidos: user.apellidos,
        email: user.email,
        rol: user.rol,
      },
    });

  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    res.status(500).json({ error: "Error interno de autenticación" });
  }
});

export default r;
