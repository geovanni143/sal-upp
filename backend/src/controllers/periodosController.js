import { pool } from "../db.js";
import { logBitacora } from "../utils/bitacora.js";

export async function crearPeriodo(req,res){
  const { nombre, fecha_inicio, fecha_fin } = req.body;
  if(!nombre || !fecha_inicio || !fecha_fin) return res.status(400).json({ok:false,msg:"Campos obligatorios"});
  if(new Date(fecha_inicio) > new Date(fecha_fin)) return res.status(400).json({ok:false,msg:"Rango de fechas inválido"});
  const [r]=await pool.query("INSERT INTO periodos (nombre,fecha_inicio,fecha_fin) VALUES (?,?,?)",[nombre,fecha_inicio,fecha_fin]);
  await logBitacora({usuario:req.user?.uid||"sys",accion:"CREATE",entidad:"periodos",entidad_id:r.insertId});
  res.json({ok:true,id:r.insertId});
}

export async function crearHorario(req,res){
  const { periodo_id, docente_id, laboratorio_id, dia, hora_ini, hora_fin, materia } = req.body;
  if(!periodo_id||!docente_id||!laboratorio_id||!dia||!hora_ini||!hora_fin) return res.status(400).json({ok:false,msg:"Campos obligatorios"});
  if(hora_ini >= hora_fin) return res.status(400).json({ok:false,msg:"hora_ini debe ser menor a hora_fin"});

  // Validar solape: mismo lab y día en el periodo, rango se cruza
  const [solapes] = await pool.query(
    `SELECT id FROM horarios WHERE periodo_id=? AND laboratorio_id=? AND dia=? 
     AND NOT (hora_fin <= ? OR hora_ini >= ?)`,
    [periodo_id, laboratorio_id, dia, hora_ini, hora_fin]
  );
  if(solapes.length) return res.status(409).json({ok:false,msg:"Solape de horario en el laboratorio"});

  const [r]=await pool.query(
    "INSERT INTO horarios (periodo_id,docente_id,laboratorio_id,dia,hora_ini,hora_fin,materia) VALUES (?,?,?,?,?,?,?)",
    [periodo_id,docente_id,laboratorio_id,dia,hora_ini,hora_fin,materia||null]
  );
  await logBitacora({usuario:req.user?.uid||"sys",accion:"CREATE",entidad:"horarios",entidad_id:r.insertId});
  res.json({ok:true,id:r.insertId});
}
