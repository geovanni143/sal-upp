import { Router } from "express";
import { pool } from "../services/db.js";
import PDFDocument from "pdfkit";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import path from "path";
import fs from "fs";


const router = Router();

/* =========================================================
   AUXILIAR: Marcar NO_ASISTIO para el día actual
   - Usa el esquema REAL de asistencias
   - NO usa created_at / updated_at
   ========================================================= */
async function marcarNoAsistioHoy(periodoId) {
  if (!periodoId) return;

  const conn = await pool.getConnection();
  try {
    const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    await conn.query(
      `
      INSERT INTO asistencias
        (horario_id, docente_id, periodo_id, fecha, estado)
      SELECT
        h.id,
        h.docente_id,
        h.periodo_id,
        ?,
        'NO_ASISTIO'
      FROM horarios h
      JOIN periodos p ON p.id = h.periodo_id
      LEFT JOIN asistencias a
        ON a.horario_id = h.id
       AND a.fecha = ?
      WHERE
        h.periodo_id = ?
        AND h.activo = 1
        AND h.eliminado = 0
        AND p.activo = 1
        AND p.eliminado = 0
        AND a.id IS NULL
      `,
      [hoy, hoy, periodoId]
    );
  } catch (err) {
    console.error("Error NO_ASISTIO:", err);
  } finally {
    conn.release();
  }
}

/* =========================================================
   GET /api/historial/filtros
   - Periodos activos
   - Laboratorios activos
   ========================================================= */
router.get("/filtros", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [periodos] = await conn.query(`
      SELECT 
        id,
        nombre,
        fecha_ini,
        fecha_fin,
        activo
      FROM periodos
      WHERE eliminado = 0
      ORDER BY fecha_ini DESC
    `);

    const [labs] = await conn.query(`
      SELECT
        id,
        nombre
      FROM labs
      WHERE activo = 1
      ORDER BY nombre
    `);

    res.json({ periodos, labs });
  } catch (err) {
    console.error("Error filtros historial:", err);
    res.status(500).json({ error: "Error al cargar filtros" });
  } finally {
    if (conn) conn.release();
  }
});

/* =========================================================
   GET /api/historial/docentes
   - Devuelve docentes con horarios
   - Si labId vacío → todos los labs
   ========================================================= */
router.get("/docentes", async (req, res) => {
  const { periodoId, labId } = req.query;

  if (!periodoId) {
    return res.status(400).json({ error: "periodoId requerido" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    let sql = `
      SELECT DISTINCT
        u.id,
        CONCAT(u.nombre, ' ', u.apellidos) AS nombre
      FROM horarios h
      JOIN users u ON u.id = h.docente_id
      WHERE h.periodo_id = ?
        AND h.activo = 1
        AND h.eliminado = 0
    `;
    const params = [periodoId];

    if (labId && labId !== "") {
      sql += ` AND h.lab_id = ? `;
      params.push(labId);
    }

    sql += ` ORDER BY nombre `;

    const [rows] = await conn.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error docentes historial:", err);
    res.status(500).json({ error: "Error al cargar docentes" });
  } finally {
    if (conn) conn.release();
  }
});

/* =========================================================
   GET /api/historial
   - Historial filtrado
   - Marca NO_ASISTIO antes de consultar
   ========================================================= */
router.get("/", async (req, res) => {
  const {
    periodoId,
    labId,
    docenteId,
    estado,
    del,
    al
  } = req.query;

  if (!periodoId) {
    return res.status(400).json({ error: "periodoId requerido" });
  }

  // Marca NO_ASISTIO del día
  await marcarNoAsistioHoy(periodoId);

  let conn;
  try {
    conn = await pool.getConnection();

    let sql = `
      SELECT
        a.id,
        l.nombre AS lab,
        COALESCE(
          CONCAT(u.nombre, ' ', u.apellidos),
          a.invitado_nombre
        ) AS docente,
        a.fecha,
        h.hora_ini,
        h.hora_fin,
        a.estado
      FROM asistencias a
      JOIN horarios h ON h.id = a.horario_id
      JOIN labs l ON l.id = h.lab_id
      JOIN periodos p ON p.id = h.periodo_id
      LEFT JOIN users u ON u.id = a.docente_id
      WHERE a.periodo_id = ?
    `;

    const params = [periodoId];

    if (labId && labId !== "") {
      sql += ` AND h.lab_id = ? `;
      params.push(labId);
    }

    if (docenteId && docenteId !== "") {
      sql += ` AND a.docente_id = ? `;
      params.push(docenteId);
    }

    if (estado && estado !== "") {
      sql += ` AND a.estado = ? `;
      params.push(estado);
    }

    if (del && del !== "") {
      sql += ` AND a.fecha >= ? `;
      params.push(del);
    }

    if (al && al !== "") {
      sql += ` AND a.fecha <= ? `;
      params.push(al);
    }

    sql += ` ORDER BY a.fecha DESC, h.hora_ini `;

    const [rows] = await conn.query(sql, params);

    res.json(
      rows.map(r => ({
        id: r.id,
        lab: r.lab,
        docente: r.docente,
        fecha: r.fecha,
        hora_ini: r.hora_ini,
        hora_fin: r.hora_fin,
        estado: r.estado
      }))
    );
  } catch (err) {
    console.error("Error historial:", err);
    res.status(500).json({ error: "Error al cargar historial" });
  } finally {
    if (conn) conn.release();
  }
});

/* =========================================================
   GET /api/historial/pdf
   - PDF general (ADMIN)
   - Usa los mismos filtros que /api/historial
   ========================================================= */
router.get(
  "/pdf",
  requireAuth,
  requireRole("admin", "superadmin"),
  async (req, res) => {
    const { periodoId, labId, docenteId, estado, del, al } = req.query;

    if (!periodoId) {
      return res.status(400).json({ error: "periodoId requerido" });
    }

    await marcarNoAsistioHoy(periodoId);

    let conn;
    try {
      conn = await pool.getConnection();

      let sql = `
        SELECT
          l.nombre AS lab,
          COALESCE(
            CONCAT(u.nombre, ' ', u.apellidos),
            a.invitado_nombre
          ) AS docente,
          a.fecha,
          h.hora_ini,
          h.hora_fin,
          a.estado,
          a.foto_url,
          a.firma_url
        FROM asistencias a
        JOIN horarios h ON h.id = a.horario_id
        JOIN labs l ON l.id = h.lab_id
        LEFT JOIN users u ON u.id = a.docente_id
        WHERE a.periodo_id = ?
      `;

      const params = [periodoId];

      if (labId) {
        sql += " AND h.lab_id = ?";
        params.push(labId);
      }
      if (docenteId) {
        sql += " AND a.docente_id = ?";
        params.push(docenteId);
      }
      if (estado) {
        sql += " AND a.estado = ?";
        params.push(estado);
      }
      if (del) {
        sql += " AND a.fecha >= ?";
        params.push(del);
      }
      if (al) {
        sql += " AND a.fecha <= ?";
        params.push(al);
      }

      sql += " ORDER BY a.fecha DESC, h.hora_ini";

      const [rows] = await conn.query(sql, params);
/* =========================
   PDF
========================= */
const doc = new PDFDocument({ size: "A4", margin: 40 });

res.setHeader("Content-Type", "application/pdf");
res.setHeader(
  "Content-Disposition",
  "attachment; filename=historial_general.pdf"
);

doc.pipe(res);

/* ===== HELPERS ===== */
const formatFecha = (f) => {
  if (!f) return "—";
  const d = new Date(f);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

/* ===== ENCABEZADO ===== */
doc.fontSize(16).text("SAL-UPP", { align: "center" });
doc.moveDown(0.3);
doc.fontSize(14).text("Historial General de Asistencias", {
  align: "center",
});

doc.moveDown(0.5);
doc.fontSize(9).text(
  `Periodo ID: ${periodoId} | Desde: ${del || "—"} | Hasta: ${al || "—"}`,
  { align: "center" }
);

doc.moveDown(0.3);
doc.text(`Generado: ${new Date().toLocaleString()}`, {
  align: "center",
});

doc.moveDown(1);

/* ===== TABLA ===== */
const startX = 40;
let y = doc.y;

const col = {
  docente: startX,        // 40
  lab: startX + 130,      // 170
  fecha: startX + 230,    // 270
  horario: startX + 300,  // 340
  estado: startX + 370,   // 410
  foto: startX + 440,     // 480
  firma: startX + 490,    // 530
};

doc.font("Helvetica-Bold").fontSize(9);
doc.text("Docente", col.docente, y);
doc.text("Lab", col.lab, y);
doc.text("Fecha", col.fecha, y);
doc.text("Horario", col.horario, y);
doc.text("Estado", col.estado, y);
doc.text("Foto", col.foto, y);
doc.text("Firma", col.firma, y);

y += 15;
doc.moveTo(startX, y).lineTo(550, y).stroke();
y += 6;

doc.font("Helvetica").fontSize(8);

/* ===== FILAS ===== */
for (const r of rows) {
  if (y > 740) {
    doc.addPage();
    y = 50;
  }

  doc.text(r.docente || "—", col.docente, y, { width: 120 });
  doc.text(r.lab || "—", col.lab, y, { width: 90 });
  doc.text(formatFecha(r.fecha), col.fecha, y, { width: 60 });

  doc.text(
    r.hora_ini && r.hora_fin
      ? `${r.hora_ini.slice(0, 5)}-${r.hora_fin.slice(0, 5)}`
      : "—",
    col.horario,
    y,
    { width: 60 }
  );

  doc.text(r.estado || "—", col.estado, y, { width: 60 });

  // 📸 FOTO
  if (r.foto_url) {
    const fotoPath = path.join(process.cwd(), r.foto_url);
    if (fs.existsSync(fotoPath)) {
      doc.image(fotoPath, col.foto, y - 2, {
        width: 28,
        height: 28,
      });
    }
  }

  // ✍️ FIRMA
  if (r.firma_url) {
    const firmaPath = path.join(process.cwd(), r.firma_url);
    if (fs.existsSync(firmaPath)) {
      doc.image(firmaPath, col.firma, y - 2, {
        width: 28,
        height: 28,
      });
    }
  }

  y += 36;
}

doc.end();

    } catch (err) {
      console.error("Error PDF historial admin:", err);
      res.status(500).json({ error: "Error al generar PDF" });
    } finally {
      if (conn) conn.release();
    }
  }
);



export default router;
