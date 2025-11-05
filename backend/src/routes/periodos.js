// periodos.js
import { Router } from 'express';
import { pool } from '../db.js';
import { logAction } from '../middlewares/bitacora.js';
const r = Router();

r.get('/', async (_req,res)=>{
  const [rows]=await pool.query('SELECT * FROM periodos ORDER BY fecha_ini DESC');
  res.json(rows);
});

r.post('/', logAction('periodos'), async (req,res)=>{
  const { nombre, fecha_ini, fecha_fin } = req.body;
  if (fecha_ini >= fecha_fin) return res.status(400).json({error:'fecha_ini < fecha_fin'});
  try{
    const [rs]=await pool.execute('INSERT INTO periodos(nombre,fecha_ini,fecha_fin) VALUES(?,?,?)',[nombre,fecha_ini,fecha_fin]);
    res.locals.entityId = rs.insertId;
    res.status(201).json({id: rs.insertId});
  }catch(e){
    if (e.code==='ER_DUP_ENTRY') return res.status(409).json({error:'Nombre de periodo ya existe'});
    res.status(500).json({error:'Error al crear'});
  }
});

export default r;
