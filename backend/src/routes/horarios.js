// horarios.js
import { Router } from 'express';
import { pool } from '../db.js';
import { rangoHorario } from '../middlewares/validate.js';
import { logAction } from '../middlewares/bitacora.js';

const r = Router();

r.get('/', async (req,res)=>{
  const [rows]=await pool.query(
    `SELECT h.*, d.nombre docente, l.clave lab, p.nombre periodo
     FROM horarios h
     JOIN docentes d ON d.id=h.docente_id
     JOIN labs l ON l.id=h.lab_id
     JOIN periodos p ON p.id=h.periodo_id
     ORDER BY p.fecha_ini DESC, dia, hora_ini`);
  res.json(rows);
});

r.post('/', rangoHorario, logAction('horarios'), async (req,res)=>{
  const { periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin } = req.body;
  // Regla: evitar solape inválido para mismo lab y día
  const [rows] = await pool.query(
    `SELECT id FROM horarios
     WHERE periodo_id=? AND lab_id=? AND dia=? 
       AND NOT (hora_fin <= ? OR hora_ini >= ?)`,
    [periodo_id, lab_id, dia, hora_ini, hora_fin]
  );
  if (rows.length) return res.status(409).json({error:'Solape inválido en el laboratorio para ese día/horario'});
  const [rs]=await pool.execute(
    'INSERT INTO horarios(periodo_id,lab_id,docente_id,dia,hora_ini,hora_fin) VALUES(?,?,?,?,?,?)',
    [periodo_id,lab_id,docente_id,dia,hora_ini,hora_fin]
  );
  res.locals.entityId = rs.insertId;
  res.status(201).json({id: rs.insertId});
});

export default r;
