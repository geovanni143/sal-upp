import { Router } from 'express';
import { pool } from '../db/mysql.js';
import { emailUPP } from '../middlewares/validate.js';
import log from '../middlewares/bitacora.js';
import crypto from 'crypto';

const r = Router();

/* LISTAR (oculta eliminados) */
r.get('/', async (req, res) => {
  const { q = '', rol = '', incl_del = '0' } = req.query;
  const w = [];
  const v = [];
  if (q) { w.push('(nombre LIKE ? OR email LIKE ?)'); v.push(`%${q}%`, `%${q}%`); }
  if (rol) { w.push('rol=?'); v.push(rol); }
  if (incl_del !== '1') w.push('eliminado=0');

  const [rows] = await pool.query(
    `SELECT id,nombre,email,rol,activo,eliminado
     FROM users
     ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
     ORDER BY nombre`, v
  );
  res.json(rows);
});

/* CREAR */
r.post('/', emailUPP, log('users'), async (req, res) => {
  const { nombre, email, rol = 'docente', password = null, activo = 1 } = req.body;
  const pass_hash = password ? crypto.createHash('sha256').update(password).digest('hex') : null;

  const [dup] = await pool.query('SELECT id FROM users WHERE email=? AND eliminado=0', [email]);
  if (dup.length) return res.status(409).json({ error: 'El email ya existe' });

  const [rs] = await pool.execute(
    'INSERT INTO users(nombre,email,rol,pass_hash,activo) VALUES(?,?,?,?,?)',
    [nombre, email, rol, pass_hash, activo]
  );
  res.locals.entityId = rs.insertId;
  res.status(201).json({ id: rs.insertId });
});

/* ACTUALIZAR */
r.put('/:id', emailUPP, log('users'), async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol = 'docente', activo = 1, password } = req.body;
  const pass_hash = password ? crypto.createHash('sha256').update(password).digest('hex') : null;

  const [dup] = await pool.query('SELECT id FROM users WHERE email=? AND id<>? AND eliminado=0', [email, id]);
  if (dup.length) return res.status(409).json({ error: 'El email ya existe' });

  const sql = pass_hash
    ? 'UPDATE users SET nombre=?, email=?, rol=?, activo=?, pass_hash=? WHERE id=? AND eliminado=0'
    : 'UPDATE users SET nombre=?, email=?, rol=?, activo=? WHERE id=? AND eliminado=0';
  const args = pass_hash
    ? [nombre, email, rol, activo, pass_hash, id]
    : [nombre, email, rol, activo, id];

  await pool.execute(sql, args);
  res.locals.entityId = id;
  res.json({ ok: true });
});

/* SOFT-DELETE (ocultar) */
r.delete('/:id', log('users'), async (req, res) => {
  const { id } = req.params;
  await pool.execute('UPDATE users SET eliminado=1, eliminado_en=NOW(), activo=0 WHERE id=?', [id]);
  res.locals.entityId = id;
  res.json({ ok: true });
});

export default r;
