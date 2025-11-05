import { Router } from 'express';
import { pool } from '../db/mysql.js';
import log from '../middlewares/bitacora.js';

const r = Router();

r.get('/', async (_req,res)=>{
  const [rows] = await pool.query('SELECT id,nombre,fecha_ini,fecha_fin,activo FROM periodos ORDER BY fecha_ini DESC');
  res.json(rows);
});

r.post('/', log('periodos'), async (req,res)=>{
  const { nombre, fecha_ini, fecha_fin, activo=1 } = req.body;
  if(new Date(fecha_ini) >= new Date(fecha_fin)) return res.status(422).json({error:'fecha_ini < fecha_fin'});
  const [dup] = await pool.query('SELECT id FROM periodos WHERE nombre=?',[nombre]);
  if(dup.length) return res.status(409).json({error:'El nombre ya existe'});
  const [rs] = await pool.execute('INSERT INTO periodos(nombre,fecha_ini,fecha_fin,activo) VALUES(?,?,?,?)',
    [nombre,fecha_ini,fecha_fin,activo]);
  res.locals.entityId = rs.insertId;
  res.status(201).json({id:rs.insertId});
});

r.put('/:id', log('periodos'), async (req,res)=>{
  const { id } = req.params;
  const { nombre, fecha_ini, fecha_fin, activo=1 } = req.body;
  if(new Date(fecha_ini) >= new Date(fecha_fin)) return res.status(422).json({error:'fecha_ini < fecha_fin'});
  const [dup] = await pool.query('SELECT id FROM periodos WHERE nombre=? AND id<>?',[nombre,id]);
  if(dup.length) return res.status(409).json({error:'El nombre ya existe'});
  await pool.execute('UPDATE periodos SET nombre=?, fecha_ini=?, fecha_fin=?, activo=? WHERE id=?',
    [nombre,fecha_ini,fecha_fin,activo,id]);
  res.locals.entityId = id;
  res.json({ok:true});
});

r.delete('/:id', log('periodos'), async (req,res)=>{
  const { id } = req.params;
  const [h] = await pool.query('SELECT id FROM horarios WHERE periodo_id=? LIMIT 1',[id]);
  if(h.length) return res.status(409).json({error:'No se puede eliminar. Existen horarios vinculados.'});
  await pool.execute('DELETE FROM periodos WHERE id=?',[id]);
  res.locals.entityId = id;
  res.json({ok:true});
});

export default r;
