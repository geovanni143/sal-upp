import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { signToken } from "../utils/jwt.js";

const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || "5", 10);
const WINDOW_MIN   = parseInt(process.env.WINDOW_MIN   || "15", 10);

/** Lee el último registro de intentos */
async function getAttempts(username) {
  const [rows] = await pool.query(
    "SELECT * FROM login_attempts WHERE username = ? ORDER BY id DESC LIMIT 1",
    [username]
  );
  return rows[0] || null;
}

/** Registra intento (success=false incrementa; success=true resetea) */
async function registerAttempt(username, success) {
  const now = new Date();
  const last = await getAttempts(username);

  if (success) {
    await pool.query(
      "INSERT INTO login_attempts (username, attempts, window_start, locked_until) VALUES (?, 0, NULL, NULL)",
      [username]
    );
    return;
  }

  if (!last || !last.window_start) {
    await pool.query(
      "INSERT INTO login_attempts (username, attempts, window_start, locked_until) VALUES (?, ?, ?, NULL)",
      [username, 1, now]
    );
    return;
  }

  const diffMin = (now - new Date(last.window_start)) / 60000;
  if (diffMin > WINDOW_MIN) {
    await pool.query(
      "INSERT INTO login_attempts (username, attempts, window_start, locked_until) VALUES (?, ?, ?, NULL)",
      [username, 1, now]
    );
    return;
  }

  const attempts = (last.attempts || 0) + 1;
  let locked_until = null;
  if (attempts >= MAX_ATTEMPTS) locked_until = new Date(now.getTime() + WINDOW_MIN * 60000);

  await pool.query(
    "INSERT INTO login_attempts (username, attempts, window_start, locked_until) VALUES (?, ?, ?, ?)",
    [username, attempts, last.window_start, locked_until]
  );
}

export async function login(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok:false, msg:"Faltan credenciales" });
    }

    // ¿Bloqueado?
    const at = await getAttempts(username);
    if (at?.locked_until && new Date(at.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(at.locked_until) - new Date())/60000);
      return res.status(429).json({ ok:false, msg:`Cuenta bloqueada. Intenta en ${mins} min.` });
    }

    // ⚠️ TABLA Y COLUMNAS REALES EN TU BD:
    // users: id, username, password_hash, nombre, email, role, activo, creado_en
    const [rows] = await pool.query(
      "SELECT id, username, password_hash, role, activo FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    const user = rows?.[0];

    if (!user) {
      await registerAttempt(username, false);
      return res.status(401).json({ ok:false, msg:"Usuario o contraseña incorrectos." });
    }

    if (user.activo !== 1 && user.activo !== true) {
      await registerAttempt(username, false);
      return res.status(403).json({ ok:false, msg:"Usuario inactivo. Contacta al administrador." });
    }

    // Comparación de contraseña (hash bcrypt en password_hash)
    let valid = false;
    if (user.password_hash && user.password_hash.startsWith("$2")) {
      valid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Fallback por si tienes texto plano temporalmente
      valid = (password === user.password_hash);
    }

    if (!valid) {
      await registerAttempt(username, false);
      return res.status(401).json({ ok:false, msg:"Usuario o contraseña incorrectos." });
    }

    await registerAttempt(username, true);

    // Token con rol
    const token = signToken({ uid: user.id, role: user.role });
    return res.json({ ok:true, token, role: user.role });

  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    return res.status(500).json({ ok:false, msg:"Error interno. Revisa logs del servidor." });
  }
}

export async function logout(_req, res) {
  return res.json({ ok:true });
}
