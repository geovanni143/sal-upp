import db from "../db/mysql.js";
import { horaMenor } from "../utils/validaciones.js";

export async function listHorarios(req,res){
  const { periodo_id } = req.query;
  let sql = `SELECT h.*, 
                p.nombre AS periodo, l.nombre AS lab, u.nombre AS docente_nombre
             FROM horarios h
             JOIN periodos p ON p.id=h.periodo_id
             JOIN labs l ON l.id=h.lab_id
             JOIN users u ON u.id=h.docente_id
             WHERE 1=1`;
  const params = [];
  if(periodo_id){ sql += " AND h.periodo_id=?"; params.push(periodo_id); }
  sql += " ORDER BY FIELD(dia,'lu','ma','mi','ju','vi','sa'), hora_ini";
  const [rows] = await db.query(sql, params);
  res.json(rows);
}

async function haySolape({ periodo_id, dia, docente_id, lab_id, hora_ini, hora_fin, idExcluido=0 }){
  const [rows] = await db.query(
  `SELECT COUNT(*) AS solapes
   FROM horarios
   WHERE periodo_id=? AND dia=? AND activo=1
     AND (docente_id=? OR lab_id=?)
     AND NOT (? >= hora_fin OR ? <= hora_ini)
     AND id<>?`,
   [periodo_id, dia, docente_id, lab_id, hora_ini, hora_fin, idExcluido]
  );
  return rows[0].solapes>0;
}

export async function createHorario(req,res){
  const { periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, activo=1 } = req.body;
  if(!periodo_id || !lab_id || !docente_id || !dia || !hora_ini || !hora_fin)
    return res.status(400).json({error:"Campos obligatorios"});

  if(!horaMenor(hora_ini, hora_fin))
    return res.status(422).json({error:"hora_ini debe ser menor a hora_fin"});

  if(await haySolape({periodo_id, dia, docente_id, lab_id, hora_ini, hora_fin}))
    return res.status(422).json({error:"Solape de horario (docente o laboratorio)"});

  await db.query(
    "INSERT INTO horarios (periodo_id,lab_id,docente_id,dia,hora_ini,hora_fin,activo) VALUES (?,?,?,?,?,?,?)",
    [periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, Number(activo)?1:0]
  );
  res.status(201).json({ok:true});
}

export async function updateHorario(req,res){
  const { id } = req.params;
  const { periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, activo=1 } = req.body;
  if(!horaMenor(hora_ini, hora_fin))
    return res.status(422).json({error:"hora_ini debe ser menor a hora_fin"});

  if(await haySolape({periodo_id, dia, docente_id, lab_id, hora_ini, hora_fin, idExcluido:Number(id)}))
    return res.status(422).json({error:"Solape de horario (docente o laboratorio)"});

  await db.query(
    "UPDATE horarios SET periodo_id=?,lab_id=?,docente_id=?,dia=?,hora_ini=?,hora_fin=?,activo=? WHERE id=?",
    [periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, Number(activo)?1:0, id]
  );
  res.json({ok:true});
}

export async function deleteHorario(req,res){
  const { id } = req.params;
  await db.query("DELETE FROM horarios WHERE id=?", [id]);
  res.json({ok:true});
}
