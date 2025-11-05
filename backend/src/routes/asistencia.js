import { Router } from 'express';
import { pool } from '../db.js';
import { upload } from '../utils/storage.js';
import { logAction } from '../middlewares/bitacora.js';

const r = Router();

/* Registro con validación S–E y laboratorio (HU-07) */
r.post('/registrar',
  upload.fields([{name:'foto',maxCount:1},{name:'firma',maxCount:1}]),
  logAction('asistencias'),
  async (req,res)=>{
    const { docente_id, lab_id } = req.body;
    const now = new Date();
    const fecha = now.toISOString().slice(0,10);
    const hora  = now.toTimeString().slice(0,8);
    const foto_url  = '/uploads/' + req.files.foto?.[0]?.filename;
    const firma_url = '/uploads/' + req.files.firma?.[0]?.filename;
    if (!foto_url || !firma_url) return res.status(400).json({error:'Falta foto o firma'});

    // Encuentra horario vigente (S–E y lab correcto)
    const dia = ((now.getDay()+6)%7)+1; // L=1..D=7
    const [[hor]] = await pool.query(
      `SELECT h.*
         FROM horarios h
         JOIN periodos p ON p.id=h.periodo_id
        WHERE h.docente_id=? AND h.lab_id=? AND h.dia=? 
          AND p.fecha_ini<=? AND p.fecha_fin>=?
          AND h.hora_ini<=? AND h.hora_fin>=? 
        LIMIT 1`,
      [docente_id, lab_id, dia, fecha, fecha, hora, hora]
    );

    let estado = 'valida', motivo = null, horario_id = null;
    if (!hor){                           // fuera de S–E o lab no coincide
      estado = 'extemporanea';
      motivo = 'Fuera de horario o laboratorio no asignado';
    } else {
      horario_id = hor.id;
    }

    // Evitar duplicado por ventana de 3 minutos del mismo docente/lab
    const [[dup]] = await pool.query(
      `SELECT id FROM asistencias 
        WHERE docente_id=? AND lab_id=? AND fecha=? 
          AND ABS(TIMESTAMPDIFF(MINUTE, CONCAT(fecha,' ',hora), ?))<=3
        LIMIT 1`,
      [docente_id, lab_id, fecha, `${fecha} ${hora}`]
    );
    if (dup) return res.status(409).json({error:'Registro duplicado cercano', registro_id: dup.id});

    const [rs]=await pool.execute(
      `INSERT INTO asistencias(docente_id,lab_id,horario_id,fecha,hora,foto_url,firma_url,estado,motivo_rechazo)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [docente_id,lab_id,horario_id,fecha,hora,foto_url,firma_url,estado,motivo]
    );
    res.locals.entityId = rs.insertId;
    res.status(201).json({id: rs.insertId, estado, mensaje: estado==='valida'?'Registro creado':'Derivado a extemporáneo (HU-08)'});
  }
);

export default r;
