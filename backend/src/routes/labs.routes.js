import { Router } from 'express';
import { pool } from '../db/mysql.js';
import log from '../middlewares/bitacora.js';

const r = Router();

r.get('/', async (_req,res)=>{
  const [rows] = await pool.query('SELECT id, clave, nombre, edificio, nivel, activo FROM labs ORDER BY nombre');
  res.json(rows);
});

r.post('/', log('labs'), async (req,res)=>{
  const { clave, nombre, edificio=null, nivel=null, activo=1 } = req.body;
  try{
    const [dup] = await pool.query('SELECT id FROM labs WHERE clave=?',[clave]);
    if(dup.length) return res.status(409).json({error:'La clave ya existe'});
    const [rs] = await pool.execute(
      'INSERT INTO labs(clave,nombre,edificio,nivel,activo) VALUES(?,?,?,?,?)',
      [clave,nombre,edificio,nivel,activo]
    );
    res.locals.entityId = rs.insertId;
    res.status(201).json({id:rs.insertId});
  }catch(e){ res.status(500).json({error:'Error al crear'}); }
});

r.put('/:id', log('labs'), async (req,res)=>{
  const { id } = req.params;
  const { clave, nombre, edificio=null, nivel=null, activo=1 } = req.body;
  const [dup] = await pool.query('SELECT id FROM labs WHERE clave=? AND id<>?',[clave,id]);
  if(dup.length) return res.status(409).json({error:'La clave ya existe'});
  await pool.execute('UPDATE labs SET clave=?, nombre=?, edificio=?, nivel=?, activo=? WHERE id=?',
    [clave,nombre,edificio,nivel,activo,id]);
  res.locals.entityId = id;
  res.json({ok:true});
});

r.delete('/:id', log('labs'), async (req,res)=>{
  const { id } = req.params;
  const [h] = await pool.query('SELECT id FROM horarios WHERE lab_id=? LIMIT 1',[id]);
  if(h.length) return res.status(409).json({error:'No se puede eliminar. Existen horarios vinculados.'});
  await pool.execute('DELETE FROM labs WHERE id=?',[id]);
  res.locals.entityId = id;
  res.json({ok:true});
});

export default r;
