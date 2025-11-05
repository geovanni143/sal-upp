import { Router } from 'express';
import { pool } from '../db/mysql.js';
import validate from '../middlewares/validate.js';
import logAction from '../middlewares/bitacora.js';
import crypto from 'crypto';

const r = Router();

// GET
r.get('/', async (_req, res) => {
  const [rows] = await pool.query('SELECT id, nombre, email, rol, activo FROM users ORDER BY nombre');
  res.json(rows);
});

// POST
r.post('/', validate.emailUPP, logAction('users'), async (req, res) => {
  const { nombre, email, rol='docente', password=null } = req.body;
  const pass_hash = password ? crypto.createHash('sha256').update(password).digest('hex') : null;
  try {
    const [rs] = await pool.execute(
      'INSERT INTO users(nombre,email,rol,pass_hash) VALUES(?,?,?,?)',
      [nombre, email, rol, pass_hash]
    );
    res.locals.entityId = rs.insertId;
    res.status(201).json({ id: rs.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El email ya existe' });
    res.status(500).json({ error: 'Error al crear' });
  }
});

// PUT
r.put('/:id', validate.emailUPP, logAction('users'), async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol, activo=1, password } = req.body;
  const pass_hash = password ? crypto.createHash('sha256').update(password).digest('hex') : null;
  const sql = pass_hash
    ? 'UPDATE users SET nombre=?, email=?, rol=?, activo=?, pass_hash=? WHERE id=?'
    : 'UPDATE users SET nombre=?, email=?, rol=?, activo=? WHERE id=?';
  const args = pass_hash
    ? [nombre, email, rol, activo, pass_hash, id]
    : [nombre, email, rol, activo, id];
  await pool.execute(sql, args);
  res.locals.entityId = id;
  res.json({ ok: true });
});

// DELETE (si no quieres borrar duro, deja solo inactivar)
r.delete('/:id', logAction('users'), async (req, res) => {
  const { id } = req.params;
  await pool.execute('UPDATE users SET activo=0 WHERE id=?', [id]);
  res.locals.entityId = id;
  res.json({ ok: true });
});

export default r;
