import { Router } from 'express';
import { pool } from '../db/mysql.js';
import log from '../middlewares/bitacora.js';

const r = Router();

/* LISTAR por periodo */
r.get('/', async (req, res) => {
  const { periodo_id } = req.query;

  const [rows] = await pool.query(
    `
    SELECT h.id, h.periodo_id, p.nombre AS periodo,
           h.lab_id, l.nombre AS lab,
           h.docente_id, u.nombre AS docente_nombre,
           h.dia, h.hora_ini, h.hora_fin, h.activo
    FROM horarios h
    JOIN periodos p ON p.id=h.periodo_id
    JOIN labs     l ON l.id=h.lab_id
    JOIN users    u ON u.id=h.docente_id
    WHERE h.eliminado=0
      ${periodo_id ? 'AND h.periodo_id=?' : ''}
    ORDER BY FIELD(h.dia,'lu','ma','mi','ju','vi','sa'), h.hora_ini
  `,
    periodo_id ? [periodo_id] : []
  );

  res.json(rows);
});

/* CREAR */
r.post('/', log('horarios'), async (req, res) => {
  const { periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, activo = 1 } = req.body;
  if (!periodo_id || !lab_id || !docente_id || !dia || !hora_ini || !hora_fin)
    return res.status(400).json({ error: 'Campos obligatorios' });

  const [rs] = await pool.execute(
    `INSERT INTO horarios (periodo_id,lab_id,docente_id,dia,hora_ini,hora_fin,activo) VALUES (?,?,?,?,?,?,?)`,
    [periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, +activo]
  );
  res.status(201).json({ id: rs.insertId });
});

/* ACTUALIZAR */
r.put('/:id', log('horarios'), async (req, res) => {
  const { id } = req.params;
  const { periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, activo = 1 } = req.body;

  await pool.execute(
    `UPDATE horarios SET periodo_id=?, lab_id=?, docente_id=?, dia=?, hora_ini=?, hora_fin=?, activo=? WHERE id=? AND eliminado=0`,
    [periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, +activo, id]
  );
  res.json({ ok: true });
});

/* TOGGLE ACTIVO */
r.patch('/:id/active', log('horarios'), async (req, res) => {
  const { id } = req.params;
  const [[row]] = await pool.query('SELECT activo FROM horarios WHERE id=? AND eliminado=0', [id]);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  const nuevo = row.activo ? 0 : 1;
  await pool.execute('UPDATE horarios SET activo=? WHERE id=?', [nuevo, id]);
  res.json({ id: +id, activo: nuevo });
});

/* SOFT-DELETE (ocultar) */
r.delete('/:id', log('horarios'), async (req, res) => {
  const { id } = req.params;
  await pool.execute('UPDATE horarios SET eliminado=1, eliminado_en=NOW(), activo=0 WHERE id=?', [id]);
  res.json({ ok: true });
});

export default r;
