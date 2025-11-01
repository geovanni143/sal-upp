// backend/src/controllers/authController.js
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { signToken } from "../utils/jwt.js";

const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || "5", 10);
const WINDOW_MIN  = parseInt(process.env.WINDOW_MIN  || "15", 10);

async function getAttempts(username){
  const [rows] = await pool.query(
    "SELECT * FROM login_attempts WHERE username = ? ORDER BY id DESC LIMIT 1",
    [username]
  );
  return rows[0] || null;
}

async function registerAttempt(username, success){
  const now = new Date();
  const at  = await getAttempts(username);

  if (success){
    await pool.query(
      "INSERT INTO login_attempts (username, attempts, window_start, locked_until) VALUES (?, 0, NULL, NULL)",
      [username]
    );
    return;
  }

  if (!at || !at.window_start){
    await pool.query(
      "INSERT INTO login_attempts (username, attempts, window_start, locked_until) VALUES (?, 1, ?, NULL)",
      [username, now]
    );
    return;
  }

  const windowStart = new Date(at.window_start);
  const diffMin = (now - windowStart)/60000;

  if (diffMin > WINDOW_MIN){
    await pool.query(
      "INSERT INTO login_attempts (username, attempts, window_start, locked_until) VALUES (?, 1, ?, NULL)",
      [username, now]
    );
    return;
  }

  const attempts = (at.attempts || 0) + 1;
  let locked_until = null;
  if (attempts >= MAX_ATTEMPTS){
    locked_until = new Date(now.getTime() + WINDOW_MIN*60000);
  }

  await pool.query(
    "INSERT INTO login_attempts (username, attempts, window_start, locked_until) VALUES (?, ?, ?, ?)",
    [username, attempts, at.window_start, locked_until]
  );
}

export async function login(req, res){
  const { username, password } = req.body;

  // ¿está bloqueado?
  const at = await getAttempts(username);
  if (at?.locked_until && new Date(at.locked_until) > new Date()){
    const mins = Math.ceil((new Date(at.locked_until) - new Date())/60000);
    return res.status(429).json({ ok:false, msg:`Cuenta bloqueada. Intenta en ${mins} min.` });
  }

  const [rows] = await pool.query(
    "SELECT id, username, password, role FROM admins WHERE username = ?",
    [username]
  );
  const user = rows[0];

  if (!user){
    await registerAttempt(username, false);
    return res.status(401).json({ ok:false, msg:"Usuario o contraseña incorrectos." });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok){
    await registerAttempt(username, false);
    return res.status(401).json({ ok:false, msg:"Usuario o contraseña incorrectos." });
  }

  await registerAttempt(username, true);

  const token = signToken({ uid: user.id, role: user.role });
  return res.json({ ok:true, token, role: user.role });
}

export async function logout(_req, res){
  // Sprint 1: stateless; el frontend borra el token.
  return res.json({ ok:true });
}
