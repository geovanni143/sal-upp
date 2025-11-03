import path from "node:path";
import dayjs from "dayjs";
import { pool } from "../db.js";
import { logBitacora } from "../utils/bitacora.js";

function hoyYdiaMX() {
  const now = dayjs();
  const map = ['D','L','M','X','J','V','S']; // domingo->D
  return { fecha: now.format("YYYY-MM-DD"), hora: now.format("HH:mm:ss"), dia: map[now.day()] };
}

export async function registrarAsistencia(req,res){
  // Campos del body/form-data:
  // docente_id, laboratorio_id, horario_id (opcional si viene por QR con código de horario),
  // origen ('qr'|'codigo')
  const { docente_id, laboratorio_id, horario_id, origen } = req.body;
  if(!docente_id || !laboratorio_id || !origen) return res.status(400).json({ok:false,msg:"Datos incompletos"});

  // Archivos: foto (obligatoria), firma (obligatoria)
  if(!req.files?.foto?.[0] || !req.files?.firma?.[0]) {
    return res.status(400).json({ok:false,msg:"Faltan foto o firma"});
  }
  const foto_path = path.join("uploads", req.files.foto[0].filename);
  const firma_path = path.join("uploads", req.files.firma[0].filename);

  // Validación HU-07: horario y laboratorio correctos y dentro de S–E
  const { fecha, hora, dia } = hoyYdiaMX();

  // Encontrar horario válido para el docente en ese lab/día/hora
  const [hor] = await pool.query(
    `SELECT h.* FROM horarios h
     JOIN periodos p ON p.id = h.periodo_id AND p.activo=1 AND CURDATE() BETWEEN p.fecha_inicio AND p.fecha_fin
     WHERE h.docente_id=? AND h.laboratorio_id=? AND h.dia=?
       AND TIME(?) BETWEEN h.hora_ini AND h.hora_fin
     LIMIT 1`,
    [docente_id, laboratorio_id, dia, hora]
  );
  const h = hor?.[0];

  if(!h){
    // fuera de horario → derivar a HU-08 (futuro). Por ahora, mensaje claro.
    return res.status(409).json({ok:false,msg:"Registro fuera de horario o en laboratorio no asignado"});
  }

  // Duplicado del día
  const [dup] = await pool.query(
    "SELECT id FROM asistencias WHERE docente_id=? AND horario_id=? AND fecha=?",
    [docente_id, h.id, fecha]
  );
  if(dup.length){
    return res.status(409).json({ok:false,msg:"Asistencia ya registrada hoy para este horario"});
  }

  // Guardar
  const [r]=await pool.query(
    "INSERT INTO asistencias (docente_id,horario_id,laboratorio_id,fecha,hora,foto_path,firma_path,origen) VALUES (?,?,?,?,?,?,?,?)",
    [docente_id, h.id, laboratorio_id, fecha, hora, foto_path, firma_path, origen]
  );
  await logBitacora({usuario:String(docente_id),accion:"CREATE",entidad:"asistencias",entidad_id:r.insertId});
  res.json({ok:true,id:r.insertId});
}
