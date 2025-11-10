import { Router } from "express";
import { pool } from "../services/db.js";
import PDFDocument from "pdfkit";            // npm i pdfkit

const r = Router();

/* Helpers */
const H_INI = "07:00:00";
const H_FIN = "20:00:00";
const DIAS = [1,2,3,4,5]; // Lun..Vie

function toTime(s){ // '07:30' -> '07:30:00'
  if (!s) return null;
  return s.length === 5 ? `${s}:00` : s;
}

/* Conflictos: se traslapan cuando (ini < fin_existente) AND (fin > ini_existente) */
async function existeChoque({ periodo_id, lab_id, docente_id, dia, hora_ini, hora_fin, ignoreId=null }) {
  const params = [periodo_id, lab_id, dia, hora_fin, hora_ini];
  let sqlLab = `
    SELECT id FROM horarios
     WHERE eliminado=0 AND periodo_id=? AND lab_id=? AND dia=?
       AND hora_ini < ? AND hora_fin > ?`;
  if (ignoreId) { sqlLab += " AND id<>?"; params.push(ignoreId); }
  const [labRows] = await pool.query(sqlLab, params);

  // Docente en cualquier lab (mismo día/ventana)
  const params2 = [periodo_id, docente_id, dia, hora_fin, hora_ini];
  let sqlDoc = `
    SELECT id FROM horarios
     WHERE eliminado=0 AND periodo_id=? AND docente_id=? AND dia=?
       AND hora_ini < ? AND hora_fin > ?`;
  if (ignoreId) { sqlDoc += " AND id<>?"; params2.push(ignoreId); }
  const [docRows] = await pool.query(sqlDoc, params2);

  return (labRows.length>0) || (docRows.length>0);
}

/* ========== GET /semana ========== 
   Devuelve todos los bloques existentes + metadatos del grid para render. */
r.get("/semana", async (req, res) => {
  try{
    const periodo_id = Number(req.query.periodo_id);
    const lab_id     = Number(req.query.lab_id);
    if (!periodo_id || !lab_id) return res.status(400).json({error:"periodo_id y lab_id requeridos"});

    const [rows] = await pool.query(
      `SELECT h.id, h.periodo_id, h.lab_id, h.docente_id, h.dia,
              DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
              DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
              h.materia, h.grupo, h.activo, u.nombre AS docente_nombre
         FROM horarios h
         JOIN users u ON u.id=h.docente_id
        WHERE h.periodo_id=? AND h.lab_id=? AND h.eliminado=0
        ORDER BY h.dia, h.hora_ini`,
      [periodo_id, lab_id]
    );

    res.json({
      grid: { dias: DIAS, h_ini: "07:00", h_fin: "20:00", pasoMin: 30 },
      bloques: rows
    });
  }catch(e){
    res.status(500).json({error:"Error al listar semana", detail:e.message});
  }
});

/* ========== POST /bulk ==========
   Guarda toda la semana: array de bloques nuevos/actualizados y array de eliminados. 
   Body:
   {
     periodo_id, lab_id,
     upserts: [{id?, dia, hora_ini:'HH:MM', hora_fin:'HH:MM', docente_id, materia, grupo?}, ...],
     deletes: [id, id, ...]
   }
*/
r.post("/bulk", async (req, res) => {
  const conn = await pool.getConnection();
  try{
    const { periodo_id, lab_id, upserts = [], deletes = [] } = req.body || {};
    if (!periodo_id || !lab_id) return res.status(400).json({error:"periodo_id y lab_id requeridos"});

    await conn.beginTransaction();

    // eliminaciones suaves
    if (deletes.length){
      await conn.query(
        `UPDATE horarios SET eliminado=1, activo=0 WHERE id IN (${deletes.map(()=>"?").join(",")})`,
        deletes
      );
    }

    // inserciones/actualizaciones con validación
    for (const b of upserts){
      const dia = Number(b.dia);
      const hora_ini = toTime(b.hora_ini);
      const hora_fin = toTime(b.hora_fin);

      if (!DIAS.includes(dia)) throw new Error("Día inválido");
      if (hora_ini < H_INI || hora_fin > H_FIN) throw new Error("Fuera del rango 07:00-20:00");
      if (hora_ini >= hora_fin) throw new Error("Rango horario inválido");

      const payload = {
        periodo_id,
        lab_id,
        docente_id: Number(b.docente_id),
        dia,
        hora_ini,
        hora_fin,
        materia: (b.materia||"").trim(),
        grupo: (b.grupo||null),
      };
      const ignoreId = b.id ? Number(b.id) : null;

      const choque = await existeChoque({...payload, ignoreId});
      if (choque) {
        await conn.rollback();
        return res.status(409).json({
          error: "Conflicto de horario",
          reason: "Se traslapa con otro bloque (en el mismo laboratorio o con el mismo docente).",
          bloque: { ...b }
        });
      }

      if (b.id){ // update
        await conn.query(
          `UPDATE horarios
              SET docente_id=?, dia=?, hora_ini=?, hora_fin=?, materia=?, grupo=?, activo=1, eliminado=0
            WHERE id=?`,
          [payload.docente_id, payload.dia, payload.hora_ini, payload.hora_fin, payload.materia, payload.grupo, b.id]
        );
      } else {   // insert
        await conn.query(
          `INSERT INTO horarios
             (periodo_id,lab_id,docente_id,dia,hora_ini,hora_fin,materia,grupo,activo,eliminado)
           VALUES (?,?,?,?,?,?,?,?,1,0)`,
          [payload.periodo_id, payload.lab_id, payload.docente_id, payload.dia, payload.hora_ini, payload.hora_fin, payload.materia, payload.grupo]
        );
      }
    }

    await conn.commit();
    res.json({ ok:true });
  }catch(e){
    try { await conn.rollback(); } catch {}
    res.status(500).json({error:"Error al guardar horarios", detail:e.message});
  }finally{
    conn.release();
  }
});

/* ========== DELETE /:id ========== */
r.delete("/:id", async (req, res) => {
  try{
    const id = Number(req.params.id);
    await pool.query("UPDATE horarios SET eliminado=1, activo=0 WHERE id=?", [id]);
    res.sendStatus(204);
  }catch(e){
    res.status(500).json({error:"Error al eliminar", detail:e.message});
  }
});

/* ========== GET /pdf (periodo_id, lab_id) ==========
   Genera PDF por laboratorio similar a los ejemplos físicos. */
r.get("/pdf", async (req, res) => {
  try{
    const periodo_id = Number(req.query.periodo_id);
    const lab_id     = Number(req.query.lab_id);
    if (!periodo_id || !lab_id) return res.status(400).json({error:"periodo_id y lab_id requeridos"});

    const [[per]] = await pool.query("SELECT nombre, DATE_FORMAT(fecha_ini,'%Y-%m-%d') fi, DATE_FORMAT(fecha_fin,'%Y-%m-%d') ff FROM periodos WHERE id=?", [periodo_id]);
    const [[lab]] = await pool.query("SELECT nombre FROM labs WHERE id=?", [lab_id]);

    const [rows] = await pool.query(
      `SELECT dia,
              DATE_FORMAT(hora_ini,'%H:%i') hi,
              DATE_FORMAT(hora_fin,'%H:%i') hf,
              materia, grupo, u.nombre AS docente
         FROM horarios h
         JOIN users u ON u.id=h.docente_id
        WHERE h.periodo_id=? AND h.lab_id=? AND h.eliminado=0
        ORDER BY dia, hora_ini`,
      [periodo_id, lab_id]
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="horario_${lab.nombre}_${per.nombre}.pdf"`);

    const doc = new PDFDocument({ size: "LETTER", margin: 36 });
    doc.pipe(res);

    // Encabezado
    doc.fontSize(12).text("UNIVERSIDAD POLITÉCNICA DE PACHUCA", { align: "center" });
    doc.moveDown(0.25);
    doc.fontSize(11).text(`HORARIO DE CLASES POR ESPACIOS EDUCATIVOS — ${per.nombre}`, { align: "center" });
    doc.moveDown(0.25);
    doc.fontSize(10).text(`PERIODO: ${per.fi} a ${per.ff}    |    LABORATORIO: ${lab.nombre}`, { align: "center" });
    doc.moveDown(0.6);

    // Tabla simple: filas = intervalos de 30 min, columnas = L..V
    const horas = [];
    const toMin = (hhmm) => {
      const [H,M] = hhmm.split(":").map(Number); return H*60+M;
    };
    for(let m=toMin("07:00"); m<toMin("20:00"); m+=30){
      const h = String(Math.floor(m/60)).padStart(2,"0");
      const s = String(m%60).padStart(2,"0");
      horas.push(`${h}:${s}`);
    }
    const colX = [36, 100, 220, 340, 460, 580]; // Hora + 5 días
    const rowH = 18;

    doc.fontSize(9).text("HORA", colX[0], doc.y, { width: 56 });
    ["LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES"].forEach((d,i)=>{
      doc.text(d, colX[i+1], doc.y, { width: 100, align:"center" });
    });
    doc.moveDown(0.4);
    let y = doc.y;

    const bloquesPorDia = {};
    for (let d of DIAS) bloquesPorDia[d] = rows.filter(r=>r.dia===d);

    for (const h of horas){
      // línea de la hora
      doc.rect(colX[0], y, colX[5]-colX[0], rowH).strokeColor("#cccccc").stroke();
      doc.fillColor("#000").text(h, colX[0]+4, y+4, { width: 60 });

      // cada día: si hay bloque que cubra esta celda, escribe materia/grupo/docente compactos
      DIAS.forEach((d, iCol)=>{
        const cX = colX[iCol+1]; const cW = 100;
        const cBloques = bloquesPorDia[d].filter(b => (b.hi <= h) && (b.hf > h));
        if (cBloques.length){
          const b = cBloques[0];
          doc.fontSize(8).fillColor("#111")
             .text(`${b.materia}${b.grupo? " ("+b.grupo+")":""}`, cX+2, y+2, { width:cW-4, align:"center" });
          doc.fontSize(7).fillColor("#333")
             .text(`${b.docente}`, cX+2, y+rowH-9, { width:cW-4, align:"center" });
        }
        doc.rect(cX, y, cW, rowH).strokeColor("#e5e7eb").stroke();
      });

      y += rowH;
      if (y > 720) { doc.addPage(); y = 60; }
    }

    doc.end();
  }catch(e){
    res.status(500).json({error:"Error al generar PDF", detail:e.message});
  }
});

export default r;
