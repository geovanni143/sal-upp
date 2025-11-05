import { Router } from 'express';
import { pool } from '../db/mysql.js';
import log from '../middlewares/bitacora.js';

const r = Router();

// helper: solape
const solapan = (a1,a2,b1,b2)=> (a1<b2 && b1<a2);

r.get('/', async (_req,res)=>{
  const [rows] = await pool.query(`
    SELECT h.id, h.periodo_id, p.nombre periodo, h.lab_id, l.nombre lab, h.docente_id, u.nombre docente,
           h.dia, h.hora_ini, h.hora_fin, h.activo
    FROM horarios h
    JOIN periodos p ON p.id=h.periodo_id
    JOIN labs l ON l.id=h.lab_id
    JOIN users u ON u.id=h.docente_id
    ORDER BY p.fecha_ini DESC, h.dia, h.hora_ini
  `);
  res.json(rows);
});

r.post('/', log('horarios'), async (req,res)=>{
  const { periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, activo=1 } = req.body;
  if(hora_ini >= hora_fin) return res.status(422).json({error:'hora_ini < hora_fin'});
  const [rows] = await pool.query(
    'SELECT hora_ini, hora_fin FROM horarios WHERE periodo_id=? AND lab_id=? AND dia=?',
    [periodo_id, lab_id, dia]
  );
  const overlap = rows.some(r=> solapan(hora_ini, hora_fin, r.hora_ini, r.hora_fin));
  if(overlap) return res.status(409).json({error:'Solape inválido en el mismo laboratorio y día'});
  const [rs] = await pool.execute(
    'INSERT INTO horarios(periodo_id,lab_id,docente_id,dia,hora_ini,hora_fin,activo) VALUES(?,?,?,?,?,?,?)',
    [periodo_id,lab_id,docente_id,dia,hora_ini,hora_fin,activo]
  );
  res.locals.entityId = rs.insertId;
  res.status(201).json({id:rs.insertId});
});

r.delete('/:id', log('horarios'), async (req,res)=>{
  const { id } = req.params;
  await pool.execute('DELETE FROM horarios WHERE id=?',[id]);
  res.locals.entityId = id;
  res.json({ok:true});
});

export default r;
