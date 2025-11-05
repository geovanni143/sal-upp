import { Router } from 'express';
import { pool } from '../db.js';
import { emailUPP } from '../middlewares/validate.js';
import { logAction } from '../middlewares/bitacora.js';

const r = Router();

r.get('/', async (_req,res)=>{
  const [rows] = await pool.query('SELECT * FROM docentes ORDER BY nombre');
  res.json(rows);
});

r.post('/', emailUPP, logAction('docentes'), async (req,res)=>{
  const { nombre, email } = req.body;
  try{
    const [rs] = await pool.execute('INSERT INTO docentes(nombre,email) VALUES(?,?)',[nombre,email]);
    res.locals.entityId = rs.insertId;
    res.status(201).json({id: rs.insertId});
  }catch(e){
    if (e.code==='ER_DUP_ENTRY') return res.status(409).json({error:'El email ya existe'});
    res.status(500).json({error:'Error al crear'});
  }
});

r.put('/:id', emailUPP, logAction('docentes'), async (req,res)=>{
  const { id } = req.params;
  const { nombre, email, activo=1 } = req.body;
  await pool.execute('UPDATE docentes SET nombre=?, email=?, activo=? WHERE id=?',[nombre,email,activo,id]);
  res.locals.entityId = id;
  res.json({ok:true});
});

export default r;
