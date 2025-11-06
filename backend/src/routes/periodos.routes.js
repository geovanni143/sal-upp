import { Router } from 'express';
import { pool } from '../db/mysql.js';
import log from '../middlewares/bitacora.js';

const r = Router();

/* LISTAR (oculta eliminados por default) */
r.get('/', async (req, res) => {
  const { q = '', incl_del = '0' } = req.query;
  const where = [];
  const vals = [];

  if (q) {
    where.push(`(nombre LIKE ? OR DATE_FORMAT(fecha_ini,'%Y-%m-%d') LIKE ? OR DATE_FORMAT(fecha_fin,'%Y-%m-%d') LIKE ?)`);
    vals.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (incl_del !== '1') where.push('eliminado=0');

  const sql = `
    SELECT id,nombre,fecha_ini,fecha_fin,activo,eliminado
    FROM periodos
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY fecha_ini DESC, id DESC
  `;
  const [rows] = await pool.query(sql, vals);
  res.json(rows);
});

/* CREAR */
r.post('/', log('periodos'), async (req, res) => {
  const { nombre, fecha_ini, fecha_fin } = req.body;
  if (!nombre || !fecha_ini || !fecha_fin) return res.status(400).json({ error: 'Nombre/fechas obligatorios' });

  const [rs] = await pool.execute(
    'INSERT INTO periodos (nombre,fecha_ini,fecha_fin,activo) VALUES (?,?,?,1)',
    [nombre, fecha_ini, fecha_fin]
  );
  res.status(201).json({ id: rs.insertId });
});

/* ACTUALIZAR */
r.put('/:id', log('periodos'), async (req, res) => {
  const { id } = req.params;
  const { nombre, fecha_ini, fecha_fin, activo = 1 } = req.body;

  await pool.execute(
    'UPDATE periodos SET nombre=?, fecha_ini=?, fecha_fin=?, activo=? WHERE id=? AND eliminado=0',
    [nombre, fecha_ini, fecha_fin, +activo, id]
  );
  res.json({ ok: true });
});

/* TOGGLE ACTIVO */
r.patch('/:id/active', log('periodos'), async (req, res) => {
  const { id } = req.params;
  const [[row]] = await pool.query('SELECT activo FROM periodos WHERE id=? AND eliminado=0', [id]);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  const nuevo = row.activo ? 0 : 1;
  await pool.execute('UPDATE periodos SET activo=? WHERE id=?', [nuevo, id]);
  res.json({ id: +id, activo: nuevo });
});

/* SOFT-DELETE (ocultar) */
r.delete('/:id', log('periodos'), async (req, res) => {
  const { id } = req.params;
  await pool.execute('UPDATE periodos SET eliminado=1, eliminado_en=NOW(), activo=0 WHERE id=?', [id]);
  res.json({ ok: true });
});

export default r;
