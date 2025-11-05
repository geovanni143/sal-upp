import { Router } from 'express';
import { pool } from '../db/mysql.js';
import dayjs from 'dayjs';

const r = Router();
const dias = ['','lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

r.get('/hoy', async (_req,res)=>{
  const now = dayjs(); // si no quieres dayjs, usa new Date()
  const diaNum = ((now.day()+6)%7)+1; // 1..7 (lun..dom)
  const hora = now.format ? now.format('HH:mm:ss') : now.toISOString().slice(11,19);

  const [rows] = await pool.query(`
    SELECT h.id, l.nombre lab, u.nombre docente, h.hora_ini, h.hora_fin
    FROM horarios h
    JOIN labs l ON l.id=h.lab_id
    JOIN users u ON u.id=h.docente_id
    WHERE h.dia=? AND h.activo=1
  `, [diaNum]);

  const data = rows.map(x=>{
    let estadoTxt='Pendiente', estadoTone='amber';
    if (hora >= x.hora_ini && hora <= x.hora_fin){ estadoTxt='Registrada'; estadoTone='green'; } // placeholder
    return { id:x.id, lab:x.lab, docente:x.docente, dia_txt:dias[diaNum], hora_ini:String(x.hora_ini).slice(0,5), hora_fin:String(x.hora_fin).slice(0,5), estadoTxt, estadoTone };
  });

  res.json(data);
});

export default r;
