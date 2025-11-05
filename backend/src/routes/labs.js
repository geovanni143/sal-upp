import { Router } from 'express';
import { pool } from '../db.js';
import { logAction } from '../middlewares/bitacora.js';

const r = Router();

r.get('/', async (_req,res)=>{
  const [rows] = await pool.query('SELECT * FROM labs ORDER BY clave');
  res.json(rows);
});

r.post('/', logAction('labs'), async (req,res)=>{
  const { clave, nombre, edificio, nivel } = req.body;
  try{
    const [rs] = await pool.execute(
      'INSERT INTO labs(clave,nombre,edificio,nivel) VALUES(?,?,?,?)',
      [clave, nombre, edificio, nivel]
    );
    res.locals.entityId = rs.insertId;
    res.status(201).json({id: rs.insertId});
  }catch(e){
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({error:'La clave de laboratorio ya existe'});
    res.status(500).json({error:'Error al crear'});
  }
});

r.put('/:id', logAction('labs'), async (req,res)=>{
  const { id } = req.params;
  const { nombre, edificio, nivel } = req.body;
  await pool.execute('UPDATE labs SET nombre=?, edificio=?, nivel=? WHERE id=?',[nombre,edificio,nivel,id]);
  res.locals.entityId = id;
  res.json({ok:true});
});

r.delete('/:id', logAction('labs'), async (req,res)=>{
  const { id } = req.params;
  const [[{ cnt }]] = await pool.query('SELECT COUNT(*) cnt FROM horarios WHERE lab_id=?',[id]);
  if (cnt>0) return res.status(409).json({error:'No se puede eliminar: laboratorio con horarios vinculados'});
  await pool.execute('DELETE FROM labs WHERE id=?',[id]);
  res.locals.entityId = id;
  res.json({ok:true});
});

export default r;
