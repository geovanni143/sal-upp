// backend/src/routes/auth.routes.js
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/mysql.js';

const r = Router();
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

// POST /api/login
r.post('/login', async (req, res) => {
  try {
    const b = req.body || {};
    const rawUser = b.user ?? b.username ?? b.email ?? b.correo ?? '';
    const password = b.password ?? b.pass ?? b.contra ?? '';
    if (!rawUser || !password) return res.status(400).json({ error: 'Faltan credenciales' });

    const email = rawUser.includes('@')
      ? rawUser.trim().toLowerCase()
      : `${rawUser.trim().toLowerCase()}@upp.edu.mx`;

    const [rows] = await pool.query(
      'SELECT id,nombre,email,rol,activo FROM users WHERE email=? AND pass_hash=? LIMIT 1',
      [email, sha256(password)]
    );

    if (!rows.length) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    const u = rows[0];
    if (!u.activo) return res.status(403).json({ error: 'Usuario inactivo' });

    const token = jwt.sign(
      { sub: u.id, email: u.email, rol: u.rol },
      process.env.JWT_SECRET || 'dev_key',
      { expiresIn: `${process.env.JWT_EXP_MIN || 120}m` }
    );

    res.json({ token, user: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } });
  } catch (e) {
    res.status(500).json({ error: 'Error de autenticación' });
  }
});

export default r;
