// backend/src/routes/horarios.routes.js
import { Router } from "express";
import { pool } from "../services/db.js";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const nowMX = () => {
  const now = new Date();
  const offsetMX = -6; // México UTC-6
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * offsetMX);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/uploads/asistencias
const ASIST_DIR = path.join(__dirname, "..", "..", "uploads", "asistencias");
if (!fs.existsSync(ASIST_DIR)) fs.mkdirSync(ASIST_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ASIST_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext || (file.mimetype === "image/png" ? ".png" : ".jpg");
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const ok = ["image/jpeg", "image/jpg", "image/png"].includes(file.mimetype);
  cb(ok ? null : new Error("invalid_file_type"), ok);
};

const uploadEvidencia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
});

const r = Router();

/* =========================================================
   HELPERS GENERALES
   ========================================================= */

// "HH:mm" desde lo que venga
const HHMM = (s) => (s || "").slice(0, 5);

// "HH:mm:ss"
const HHMMSS = (s) => `${HHMM(s)}:00`;

// pasar "HH:mm" a minutos
const toMin = (s) => {
  if (!s) return 0;
  const [H, M] = String(s).split(":").map(Number);
  return (H || 0) * 60 + (M || 0);
};

// minutos -> "HH:mm"
const fromMin = (m) => {
  const H = Math.floor(m / 60);
  const M = m % 60;
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
};

// redondear hacia abajo/arriba a bloques de 30
const floorTo30 = (m) => Math.floor(m / 30) * 30;
const ceilTo30 = (m) => Math.ceil(m / 30) * 30;

// ¿hoy está entre fecha_ini y fecha_fin?  (YYYY-MM-DD)
function isTodayBetween(iniStr, finStr) {
  if (!iniStr || !finStr) return false;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  return todayStr >= iniStr && todayStr <= finStr;
}

// Normalizar día de DB / front → número 1..5
function normalizarDiaDB(dia) {
  const map = { lu: 1, ma: 2, mi: 3, ju: 4, vi: 5 };

  if (typeof dia === "number") return dia;
  if (typeof dia === "string") {
    const s = dia.trim().toLowerCase();
    if (map[s]) return map[s];
    const n = Number(s);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function nombreDia(d) {
  const n = normalizarDiaDB(d);
  const map = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
  };
  return map[n] || "Día desconocido";
}

// Código numérico de 4 dígitos
function generarCodigo4Digitos() {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 1000–9999
}

// Día actual JS → 1..7 (1 = lunes)
function diaActualNumero() {
  const d = new Date().getDay(); // 0=Dom ... 6=Sab
  if (d === 0) return 7;
  return d;
}

/* =========================================================
   HELPERS ESPECÍFICOS PARA QR
   ========================================================= */

/**
 * Asegura que exista un código QR para la combinación periodo+lab.
 * Si no existe, genera uno único y lo guarda en TODOS los bloques
 * de ese horario (misma combinación).
 */
async function ensureQrCodeForHorario(periodo_id, lab_id) {
  const [rows] = await pool.query(
    `
SELECT
  h.periodo_id,
  MIN(p.nombre) AS periodo_nombre,
  MIN(DATE_FORMAT(p.fecha_ini,'%Y-%m-%d')) AS periodo_ini,
  MIN(DATE_FORMAT(p.fecha_fin,'%Y-%m-%d')) AS periodo_fin,
  h.lab_id,
  MIN(l.nombre) AS lab_nombre,
  COUNT(*) AS bloques_activos,
  MIN(h.codigo_qr) AS codigo_qr
FROM horarios h
JOIN periodos p ON p.id = h.periodo_id
JOIN labs     l ON l.id = h.lab_id
WHERE IFNULL(h.eliminado,0)=0
  AND h.periodo_id=?
  AND h.lab_id=?
GROUP BY h.periodo_id, h.lab_id

    `,
    [periodo_id, lab_id]
  );

  if (!rows || rows.length === 0) {
    return { ok: false, msg: "no_blocks_for_combo" };
  }

  const r0 = rows[0];
  let codigo = r0.codigo_qr;

  if (!codigo) {
    let unique = false;
    let intento = 0;

    while (!unique && intento < 50) {
      intento++;
      const candidate = generarCodigo4Digitos();
      const [[chk]] = await pool.query(
        `SELECT COUNT(*) AS n FROM horarios WHERE codigo_qr=?`,
        [candidate]
      );
      if (Number(chk.n) === 0) {
        codigo = candidate;
        unique = true;
      }
    }

    if (!unique || !codigo) {
      return { ok: false, msg: "cannot_generate_unique_code" };
    }

    await pool.query(
      `
      UPDATE horarios
      SET codigo_qr=?
      WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0
      `,
      [codigo, periodo_id, lab_id]
    );
  }

  return {
    ok: true,
    codigo,
    meta: {
      periodo_id: r0.periodo_id,
      lab_id: r0.lab_id,
      periodo_nombre: r0.periodo_nombre,
      periodo_ini: r0.periodo_ini,
      periodo_fin: r0.periodo_fin,
      lab_nombre: r0.lab_nombre,
      bloques_activos: Number(r0.bloques_activos),
    },
  };
}

/* =========================================================
   CATÁLOGO DE HORARIOS (combinación periodo+lab)
   ========================================================= */

r.get("/catalogo", async (req, res) => {
  try {
    const { search = "", mostrar_eliminados = "0" } = req.query;
    const showDeleted = Number(mostrar_eliminados) === 1;

    const filtros = [];
    const params = [];

    if (showDeleted) filtros.push("IFNULL(h.eliminado,0) = 1");
    else filtros.push("IFNULL(h.eliminado,0) = 0");

    if (search) {
      filtros.push("(p.nombre LIKE ? OR l.nombre LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like);
    }

    const where = filtros.length ? "WHERE " + filtros.join(" AND ") : "";

    const [rows] = await pool.query(
      `
SELECT
  h.periodo_id,
  MIN(p.nombre) AS periodo_nombre,
  MIN(DATE_FORMAT(p.fecha_ini,'%Y-%m-%d')) AS periodo_ini,
  MIN(DATE_FORMAT(p.fecha_fin,'%Y-%m-%d')) AS periodo_fin,
  h.lab_id,
  MIN(l.nombre) AS lab_nombre,
  COUNT(*) AS bloques_activos,
  MIN(IFNULL(h.activo,0)) AS activo_flag
FROM horarios h
JOIN periodos p ON p.id = h.periodo_id
JOIN labs     l ON l.id = h.lab_id
${where}
GROUP BY h.periodo_id, h.lab_id
ORDER BY periodo_ini DESC, lab_nombre ASC

      `,
      params
    );

    const data = rows.map((r) => {
      const en_curso = isTodayBetween(r.periodo_ini, r.periodo_fin);
      return {
        periodo_id: r.periodo_id,
        lab_id: r.lab_id,
        periodo_nombre: r.periodo_nombre,
        periodo_ini: r.periodo_ini,
        periodo_fin: r.periodo_fin,
        lab_nombre: r.lab_nombre,
        bloques_activos: Number(r.bloques_activos),
        horario_eliminado: showDeleted ? 1 : 0,
        activo: showDeleted ? 0 : Number(r.activo_flag),
        en_curso,
      };
    });

    res.json({ ok: true, items: data });
  } catch (err) {
    console.error("GET /horarios/catalogo:", err);
    res.status(500).json({ ok: false, msg: "server_error", items: [] });
  }
});

r.get("/catalogo/:periodo_id/:lab_id", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;
    const [rows] = await pool.query(
      `
      SELECT 
        id, periodo_id, lab_id, dia,
        DATE_FORMAT(hora_ini,'%H:%i') AS hora_ini,
        DATE_FORMAT(hora_fin,'%H:%i') AS hora_fin,
        materia, codigo, grupo, docente_id, activo
      FROM horarios
      WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0
      ORDER BY dia, hora_ini
      `,
      [periodo_id, lab_id]
    );
    res.json({ ok: true, bloques: rows });
  } catch (err) {
    console.error("GET /horarios/catalogo/:pid/:lid:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   ACTIVAR / DESACTIVAR / ELIMINAR / RESTAURAR HORARIO
   ========================================================= */

r.patch("/catalogo/:periodo_id/:lab_id/activar", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    await pool.query(
      `UPDATE horarios SET activo=1 
       WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0`,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, msg: "Horario activado" });
  } catch (err) {
    console.error("PATCH activar horario:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

r.patch("/catalogo/:periodo_id/:lab_id/desactivar", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    const [[p]] = await pool.query(
      `SELECT DATE_FORMAT(fecha_ini,'%Y-%m-%d') AS ini,
              DATE_FORMAT(fecha_fin,'%Y-%m-%d') AS fin
       FROM periodos WHERE id=?`,
      [periodo_id]
    );

    if (!p) return res.json({ ok: false, msg: "Periodo no encontrado" });

    if (isTodayBetween(p.ini, p.fin)) {
      return res.json({
        ok: false,
        msg: "No puedes desactivar un horario que está en curso.",
      });
    }

    await pool.query(
      `UPDATE horarios SET activo=0 
       WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0`,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, msg: "Horario desactivado" });
  } catch (err) {
    console.error("PATCH desactivar horario:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

r.delete("/catalogo/:periodo_id/:lab_id", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    const [[p]] = await pool.query(
      `SELECT DATE_FORMAT(fecha_ini,'%Y-%m-%d') AS ini,
              DATE_FORMAT(fecha_fin,'%Y-%m-%d') AS fin
       FROM periodos WHERE id=?`,
      [periodo_id]
    );

    if (!p) return res.json({ ok: false, msg: "Periodo no encontrado" });

    if (isTodayBetween(p.ini, p.fin)) {
      return res.json({
        ok: false,
        msg: "No puedes eliminar un horario mientras el período está en curso.",
      });
    }

    await pool.query(
      `UPDATE horarios SET eliminado=1, eliminado_en=NOW() 
       WHERE periodo_id=? AND lab_id=?`,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, msg: "Horario eliminado." });
  } catch (err) {
    console.error("DELETE horario:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

r.delete("/catalogo/:periodo_id/:lab_id/hard", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    const [result] = await pool.query(
      `DELETE FROM horarios 
       WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=1`,
      [periodo_id, lab_id]
    );

    return res.json({
      ok: true,
      msg:
        result.affectedRows > 0
          ? "Horario eliminado permanentemente."
          : "No había bloques para eliminar (ya estaba limpio).",
    });
  } catch (err) {
    console.error("DELETE HARD horario:", err);
    return res.json({
      ok: false,
      msg:
        "No se pudo eliminar permanentemente el horario (revisa si tiene registros relacionados).",
    });
  }
});

r.post("/catalogo/:periodo_id/:lab_id/restore", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    await pool.query(
      `UPDATE horarios SET eliminado=0, eliminado_en=NULL 
       WHERE periodo_id=? AND lab_id=?`,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, msg: "Horario restaurado." });
  } catch (err) {
    console.error("POST restore horario:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   GET /api/horarios/semana
   ========================================================= */

r.get("/semana", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.query;
    if (!periodo_id || !lab_id) {
      return res
        .status(400)
        .json({ ok: false, msg: "missing_ids", bloques: [] });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        h.id,
        h.periodo_id,
        h.lab_id,
        h.dia,
        DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
        DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
        h.materia,
        h.codigo,
        h.grupo,
        h.docente_id,
        h.activo,
        CONCAT(
          COALESCE(u.nombre,''), 
          IF(u.apellidos IS NULL OR u.apellidos='', '', CONCAT(' ',u.apellidos))
        ) AS docente_nombre
      FROM horarios h
      LEFT JOIN users u ON u.id = h.docente_id
      WHERE h.periodo_id=? AND h.lab_id=? AND IFNULL(h.eliminado,0)=0
      ORDER BY h.dia, h.hora_ini
      `,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, bloques: rows });
  } catch (err) {
    console.error("GET /horarios/semana:", err);
    res.status(500).json({ ok: false, msg: "server_error", bloques: [] });
  }
});

/* =========================================================
   POST /api/horarios/bulk
   ========================================================= */

r.post("/bulk", async (req, res) => {
  const {
    periodo_id,
    lab_id,
    upserts = [],
    from_periodo_id,
    from_lab_id,
  } = req.body || {};

  if (!periodo_id || !lab_id) {
    return res
      .status(400)
      .json({ ok: false, msg: "missing_ids (periodo_id, lab_id)" });
  }

  const blocks = Array.isArray(upserts) ? upserts : [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (
      from_periodo_id &&
      from_lab_id &&
      (Number(from_periodo_id) !== Number(periodo_id) ||
        Number(from_lab_id) !== Number(lab_id))
    ) {
      await conn.query(
        `
        DELETE FROM horarios
        WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0
        `,
        [from_periodo_id, from_lab_id]
      );
    }

    await conn.query(
      `
      DELETE FROM horarios
      WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0
      `,
      [periodo_id, lab_id]
    );

    for (const b of blocks) {
      const diaN = normalizarDiaDB(b.dia);
      if (!diaN) continue;

      const horaIni = HHMMSS(b.hora_ini);
      const horaFin = HHMMSS(b.hora_fin);

      await conn.query(
        `
        INSERT INTO horarios
          (periodo_id, lab_id, dia, hora_ini, hora_fin,
           materia, codigo, grupo, docente_id, activo, eliminado, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,0,NOW())
        `,
        [
          periodo_id,
          lab_id,
          diaN,
          horaIni,
          horaFin,
          b.materia || null,
          b.codigo || null,
          b.grupo || null,
          b.docente_id || null,
          1,
        ]
      );
    }

    await conn.commit();

    res.json({
      ok: true,
      msg: "Horario guardado",
      bloques: blocks.length,
    });
  } catch (err) {
    await conn.rollback();
    console.error("POST /horarios/bulk:", err);
    res.status(500).json({
      ok: false,
      msg:
        err?.sqlMessage ||
        "No se pudo guardar. Revisa que no haya conflictos de horarios de docentes.",
    });
  } finally {
    conn.release();
  }
});

/* =========================================================
   ✅✅✅ PDF CORREGIDO /api/horarios/pdf
   - Wrap real (no se encima)
   - Calcula altura por fila
   - Recorta horas muertas
   - Multi página con encabezado de tabla
   ========================================================= */

r.get("/pdf", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.query;

    if (!periodo_id || !lab_id) {
      return res
        .status(400)
        .json({ ok: false, msg: "missing_ids (periodo_id, lab_id)" });
    }

    const [[p]] = await pool.query(
      `
      SELECT nombre,
             DATE_FORMAT(fecha_ini,'%Y-%m-%d') AS ini,
             DATE_FORMAT(fecha_fin,'%Y-%m-%d') AS fin
      FROM periodos WHERE id=?
      `,
      [periodo_id]
    );

    const [[l]] = await pool.query(`SELECT nombre FROM labs WHERE id=?`, [lab_id]);

    const [rows] = await pool.query(
      `
      SELECT 
        h.dia,
        DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
        DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
        h.materia,
        h.codigo,
        h.grupo,
        CONCAT(
          COALESCE(u.nombre,''), 
          IF(u.apellidos IS NULL OR u.apellidos='', '', CONCAT(' ',u.apellidos))
        ) AS docente_nombre
      FROM horarios h
      LEFT JOIN users u ON u.id = h.docente_id
      WHERE h.periodo_id=? AND h.lab_id=? AND IFNULL(h.eliminado,0)=0
      ORDER BY h.dia, h.hora_ini
      `,
      [periodo_id, lab_id]
    );

    const bloques = (rows || []).map((b) => ({
      dia: normalizarDiaDB(b.dia),
      hora_ini: b.hora_ini,
      hora_fin: b.hora_fin,
      materia: b.materia || "",
      codigo: b.codigo || "",
      grupo: b.grupo || "",
      docente_nombre: b.docente_nombre || "",
    }));

    const cellBloque = (dia, hhmm) =>
      bloques.find(
        (b) =>
          Number(b.dia) === Number(dia) &&
          b.hora_ini <= hhmm &&
          b.hora_fin > hhmm
      ) || null;

    // ============ HORAS DINÁMICAS (quita horas muertas) ============
    let times = [];
    if (bloques.length) {
      const minM = Math.min(...bloques.map((b) => toMin(b.hora_ini)));
      const maxM = Math.max(...bloques.map((b) => toMin(b.hora_fin)));
      const start = floorTo30(minM);
      const end = ceilTo30(maxM);
      for (let t = start; t < end; t += 30) times.push(fromMin(t));
    } else {
      // si no hay bloques, por default una tabla completa "normal"
      const start = toMin("07:00");
      const end = toMin("19:00");
      for (let t = start; t < end; t += 30) times.push(fromMin(t));
    }

    // ============ PDF ============
    const doc = new PDFDocument({
      size: "LETTER",
      layout: "portrait", // ✅ como tu PDF “bueno”
      margin: 36,
      autoFirstPage: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="horario-${periodo_id}-${lab_id}.pdf"`
    );

    doc.pipe(res);

    // ---- Header grande SOLO en la primera página (como tu ejemplo)
    const drawMainHeader = () => {
      doc.font("Helvetica");
      doc.fontSize(12).text("UNIVERSIDAD POLITÉCNICA DE PACHUCA", { align: "center" });
      doc.moveDown(0.25);
      doc.fontSize(10).text("HORARIO DE CLASES POR ESPACIOS EDUCATIVOS", { align: "center" });
      doc.moveDown(0.25);

      const tituloPeriodo = p ? `${p.nombre} (${p.ini} — ${p.fin})` : "";
      const tituloLab = l ? `HORARIO DE ${l.nombre}` : "";

      if (tituloPeriodo) doc.fontSize(9).text(tituloPeriodo, { align: "center" });
      if (tituloLab) doc.fontSize(9).text(tituloLab, { align: "center" });

      doc.moveDown(0.7);
    };

    // ---- Tabla (grid) estilo “bueno”
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const M = doc.page.margins.left;

    const tableX = M;
    let tableY = doc.y;

    const tableW = pageW - M * 2;

    const colHoraW = 78;
    const colW = (tableW - colHoraW) / 5;

    const headerH = 22;
    const pad = 4;

    const dias = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"];

    const drawTableHeader = (y) => {
      doc.lineWidth(1);

      // fila header completa (borde exterior)
      doc.rect(tableX, y, tableW, headerH).stroke();

      // separadores verticales
      // hora
      doc.moveTo(tableX + colHoraW, y).lineTo(tableX + colHoraW, y + headerH).stroke();
      // días
      for (let i = 1; i < 5; i++) {
        const x = tableX + colHoraW + colW * i;
        doc.moveTo(x, y).lineTo(x, y + headerH).stroke();
      }

      doc.font("Helvetica").fontSize(8.5);

      doc.text("HORA", tableX, y + 6, { width: colHoraW, align: "center" });

      dias.forEach((d, idx) => {
        doc.text(
          d,
          tableX + colHoraW + colW * idx,
          y + 6,
          { width: colW, align: "center" }
        );
      });

      return y + headerH;
    };

    const formatCell = (b) => {
      if (!b) return "";
      const top = [b.materia, b.codigo].filter(Boolean).join(" — ");
      const lines = [];
      if (top) lines.push(top);
      if (b.grupo) lines.push(`Grupo: ${b.grupo}`);
      if (b.docente_nombre) lines.push(`Imparte: ${b.docente_nombre}`);
      return lines.join("\n");
    };

    const calcRowHeight = (rowTexts) => {
      doc.font("Helvetica").fontSize(7.5);

      let maxH = 18; // mínimo
      for (const txt of rowTexts) {
        if (!txt) continue;
        const h = doc.heightOfString(txt, {
          width: colW - pad * 2,
          align: "left",
        });
        maxH = Math.max(maxH, h + pad * 2);
      }
      // límite razonable (evita filas enormes si alguien mete biblias)
      return Math.min(Math.max(maxH, 26), 92);
    };

    const drawRow = (y, hhmm, rowTexts) => {
      const rowH = calcRowHeight(rowTexts);

      // Si no cabe, nueva página
      const bottomLimit = pageH - doc.page.margins.bottom;
      if (y + rowH > bottomLimit) {
        doc.addPage();
        // en páginas 2+, NO repetimos el header grande, solo la tabla
        y = doc.page.margins.top;
        y = drawTableHeader(y);
      }

      doc.lineWidth(1);

      // rect de fila completa
      doc.rect(tableX, y, tableW, rowH).stroke();

      // verticales
      doc.moveTo(tableX + colHoraW, y).lineTo(tableX + colHoraW, y + rowH).stroke();
      for (let i = 1; i < 5; i++) {
        const x = tableX + colHoraW + colW * i;
        doc.moveTo(x, y).lineTo(x, y + rowH).stroke();
      }

      // Hora centrada
      doc.font("Helvetica").fontSize(8);
      doc.text(hhmm, tableX, y + rowH / 2 - 4, { width: colHoraW, align: "center" });

      // Celdas con CLIP para que jamás se encime fuera
      doc.font("Helvetica").fontSize(7.5);

      for (let i = 0; i < 5; i++) {
        const x = tableX + colHoraW + colW * i;
        const txt = rowTexts[i] || "";

        if (txt) {
          doc.save();
          doc.rect(x + 1, y + 1, colW - 2, rowH - 2).clip();

          doc.text(txt, x + pad, y + pad, {
            width: colW - pad * 2,
            align: "left",
            lineGap: 1.2,
          });

          doc.restore();
        }
      }

      return y + rowH;
    };

    // ======= Render final =======
    drawMainHeader();
    tableY = drawTableHeader(tableY);

    for (const hhmm of times) {
      const rowTexts = [];
      for (let d = 1; d <= 5; d++) {
        const b = cellBloque(d, hhmm);
        rowTexts.push(formatCell(b));
      }
      tableY = drawRow(tableY, hhmm, rowTexts);
    }

    doc.end();
  } catch (err) {
    console.error("GET /horarios/pdf:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   LISTA DE HORARIOS PARA GENERAR QR
   ========================================================= */

r.get("/lista", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
SELECT
  h.periodo_id,
  MIN(p.nombre) AS periodo_nombre,
  MIN(DATE_FORMAT(p.fecha_ini,'%Y-%m-%d')) AS periodo_ini,
  MIN(DATE_FORMAT(p.fecha_fin,'%Y-%m-%d')) AS periodo_fin,
  h.lab_id,
  MIN(l.nombre) AS lab_nombre,
  COUNT(*) AS bloques_activos,
  MIN(h.codigo_qr) AS codigo_qr
FROM horarios h
JOIN periodos p ON p.id = h.periodo_id
JOIN labs     l ON l.id = h.lab_id
WHERE IFNULL(h.eliminado,0)=0
GROUP BY h.periodo_id, h.lab_id
ORDER BY periodo_ini DESC, lab_nombre ASC
      `
    );

    const items = rows.map((r) => ({
      periodo_id: r.periodo_id,
      lab_id: r.lab_id,
      periodo_nombre: r.periodo_nombre,
      periodo_ini: r.periodo_ini,
      periodo_fin: r.periodo_fin,
      lab_nombre: r.lab_nombre,
      bloques_activos: Number(r.bloques_activos),
      codigo_qr: r.codigo_qr || null,
      en_curso: isTodayBetween(r.periodo_ini, r.periodo_fin),
    }));

    res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /horarios/lista:", err);
    res.status(500).json({ ok: false, items: [] });
  }
});

/* =========================================================
   GENERAR QR
   ========================================================= */

r.post("/generar-qr", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.body || {};

    if (!periodo_id || !lab_id) {
      return res
        .status(400)
        .json({ ok: false, msg: "missing_ids (periodo_id, lab_id)" });
    }

    const result = await ensureQrCodeForHorario(periodo_id, lab_id);
    if (!result.ok) {
      return res.status(400).json({ ok: false, msg: result.msg });
    }

    const { codigo, meta } = result;

    const payload = {
      scope: "sal-upp-horario",
      version: 1,
      codigo,
      periodo_id: meta.periodo_id,
      lab_id: meta.lab_id,
      periodo_nombre: meta.periodo_nombre,
      periodo_ini: meta.periodo_ini,
      periodo_fin: meta.periodo_fin,
      lab_nombre: meta.lab_nombre,
    };

    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload));

    res.json({
      ok: true,
      codigo,
      qr: qrDataUrl,
      horario: payload,
    });
  } catch (err) {
    console.error("POST /horarios/generar-qr:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   PDF SOLO DE QR
   ========================================================= */

r.get("/qr-pdf", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.query;

    if (!periodo_id || !lab_id) {
      return res
        .status(400)
        .json({ ok: false, msg: "missing_ids (periodo_id, lab_id)" });
    }

    const result = await ensureQrCodeForHorario(periodo_id, lab_id);
    if (!result.ok) return res.status(400).json({ ok: false, msg: result.msg });

    const { codigo, meta } = result;

    const payload = {
      scope: "sal-upp-horario",
      version: 1,
      codigo,
      periodo_id: meta.periodo_id,
      lab_id: meta.lab_id,
      periodo_nombre: meta.periodo_nombre,
      periodo_ini: meta.periodo_ini,
      periodo_fin: meta.periodo_fin,
      lab_nombre: meta.lab_nombre,
    };

    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload));
    const base64 = qrDataUrl.split(",")[1];
    const imgBuffer = Buffer.from(base64, "base64");

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="qr-horario-${periodo_id}-${lab_id}.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(12).text("UNIVERSIDAD POLITÉCNICA DE PACHUCA", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(11).text("CÓDIGO QR PARA REGISTRO DE ASISTENCIA", { align: "center" });

    doc.moveDown(0.4);
    doc
      .fontSize(10)
      .text(
        `Periodo: ${meta.periodo_nombre} (${meta.periodo_ini} — ${meta.periodo_fin})`,
        { align: "center" }
      );
    doc.fontSize(10).text(`Laboratorio: ${meta.lab_nombre}`, { align: "center" });

    doc.moveDown(1);
    doc.fontSize(11).text(`Código de horario: ${codigo}`, { align: "center" });

    doc.moveDown(1.5);

    const qrSize = 320;
    const qrX = (doc.page.width - qrSize) / 2;
    const qrY = doc.y;

    doc.image(imgBuffer, qrX, qrY, { width: qrSize });

    const afterQrY = qrY + qrSize + 30;
    doc.y = afterQrY;
    doc.fontSize(48).text(codigo, { align: "center" });

    doc.end();
  } catch (err) {
    console.error("GET /horarios/qr-pdf:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   VALIDAR ESCANEO DE QR
   ========================================================= */

r.post("/qr/validar-escaneo", async (req, res) => {
  try {
    const { codigo, docente_id, lab_id } = req.body || {};
    if (!codigo) return res.status(400).json({ ok: false, msg: "missing_code" });

    const [rows] = await pool.query(
      `
      SELECT 
        h.id,
        h.periodo_id,
        h.lab_id,
        h.dia,
        DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
        DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
        h.docente_id,
        p.nombre AS periodo_nombre,
        DATE_FORMAT(p.fecha_ini,'%Y-%m-%d') AS periodo_ini,
        DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS periodo_fin,
        l.nombre AS lab_nombre
      FROM horarios h
      JOIN periodos p ON p.id = h.periodo_id
      JOIN labs     l ON l.id = h.lab_id
      WHERE h.codigo_qr=? AND IFNULL(h.eliminado,0)=0 AND h.activo=1
      `,
      [codigo]
    );

    if (!rows || rows.length === 0) {
      return res
        .status(404)
        .json({ ok: false, msg: "invalid_code", reason: "no_rows" });
    }

const now = nowMX();
    const currentHHMM = now.toTimeString().slice(0, 5);
    const currentDay = diaActualNumero(); // 1..7

    const meta = {
      periodo_id: rows[0].periodo_id,
      lab_id: rows[0].lab_id,
      periodo_nombre: rows[0].periodo_nombre,
      periodo_ini: rows[0].periodo_ini,
      periodo_fin: rows[0].periodo_fin,
      lab_nombre: rows[0].lab_nombre,
    };

    if (!isTodayBetween(meta.periodo_ini, meta.periodo_fin)) {
      return res.status(400).json({ ok: false, msg: "out_of_period", meta });
    }

    const diaFilter = currentDay >= 1 && currentDay <= 5 ? currentDay : null;
    const rowsHoy = diaFilter
      ? rows.filter((r) => normalizarDiaDB(r.dia) === diaFilter)
      : [];

    if (!rowsHoy.length) {
      return res.status(400).json({ ok: false, msg: "no_class_today", meta });
    }

    const tNow = toMin(currentHHMM);
    const bloquesHora = rowsHoy.filter((r) => {
      const ini = toMin(r.hora_ini);
      const fin = toMin(r.hora_fin);
      return tNow >= ini && tNow < fin;
    });

    if (!bloquesHora.length) {
      return res.status(400).json({
        ok: false,
        msg: "out_of_schedule_time",
        meta,
        current_time: currentHHMM,
      });
    }

    let docenteValido = true;
    if (docente_id) {
      docenteValido = bloquesHora.some(
        (b) => Number(b.docente_id) === Number(docente_id)
      );
      if (!docenteValido) {
        return res.status(403).json({ ok: false, msg: "wrong_teacher", meta });
      }
    }

    if (lab_id && Number(lab_id) !== Number(meta.lab_id)) {
      return res.status(400).json({ ok: false, msg: "wrong_lab", meta });
    }

    return res.json({
      ok: true,
      msg: "scan_ok",
      meta,
      current_time: currentHHMM,
      docente_valido: docenteValido,
    });
  } catch (err) {
    console.error("POST /horarios/qr/validar-escaneo:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   REGISTRAR ASISTENCIA POR QR
   ========================================================= */

r.post("/qr/registrar", async (req, res) => {
  try {
    const { codigo, docente_id, invitado_nombre } = req.body || {};
    const testMode = String(req.query?.test || req.body?.test || "") === "1";

    if (!codigo) return res.status(400).json({ ok: false, msg: "missing_code" });

    const [rows] = await pool.query(
      `
      SELECT 
        h.id,
        h.periodo_id,
        h.lab_id,
        h.dia,
        DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
        DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
        h.docente_id,
        p.nombre AS periodo_nombre,
        DATE_FORMAT(p.fecha_ini,'%Y-%m-%d') AS periodo_ini,
        DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS periodo_fin,
        l.nombre AS lab_nombre
      FROM horarios h
      JOIN periodos p ON p.id = h.periodo_id
      JOIN labs     l ON l.id = h.lab_id
      WHERE h.codigo_qr=? AND IFNULL(h.eliminado,0)=0 AND h.activo=1
      `,
      [codigo]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "invalid_code" });
    }

const now = nowMX();
    const todayStr = now.toISOString().slice(0, 10);
    const currentHHMM = now.toTimeString().slice(0, 5);
    const currentDay = diaActualNumero(); // 1..7

    const meta = {
      periodo_id: rows[0].periodo_id,
      lab_id: rows[0].lab_id,
      periodo_ini: rows[0].periodo_ini,
      periodo_fin: rows[0].periodo_fin,
      periodo_nombre: rows[0].periodo_nombre,
      lab_nombre: rows[0].lab_nombre,
    };

    if (!isTodayBetween(meta.periodo_ini, meta.periodo_fin)) {
      return res.status(400).json({ ok: false, msg: "out_of_period", meta });
    }

    let rowsHoy = [];
    if (testMode) rowsHoy = rows;
    else {
      const diaFilter = currentDay >= 1 && currentDay <= 5 ? currentDay : null;
      rowsHoy = diaFilter
        ? rows.filter((r) => normalizarDiaDB(r.dia) === diaFilter)
        : [];
      if (!rowsHoy.length) {
        return res.status(400).json({ ok: false, msg: "no_class_today", meta });
      }
    }

    let bloquesHora = [];
    if (testMode) bloquesHora = rowsHoy;
    else {
      const tNow = toMin(currentHHMM);
      bloquesHora = rowsHoy.filter((r) => {
        const ini = toMin(r.hora_ini);
        const fin = toMin(r.hora_fin);
        return tNow >= ini && tNow < fin;
      });

      if (!bloquesHora.length) {
        return res.status(400).json({
          ok: false,
          msg: "out_of_schedule_time",
          meta,
          current_time: currentHHMM,
        });
      }
    }

    if (docente_id) {
      const docenteValido = bloquesHora.some(
        (b) => Number(b.docente_id) === Number(docente_id)
      );
      if (!docenteValido) {
        return res.status(403).json({ ok: false, msg: "wrong_teacher", meta });
      }
    }

    const chosen =
      docente_id
        ? bloquesHora.find((b) => Number(b.docente_id) === Number(docente_id)) ||
          bloquesHora[0]
        : bloquesHora[0];

    const horario_id = chosen.id;

    if (docente_id) {
      const [dup] = await pool.query(
        `
        SELECT id FROM asistencias
        WHERE horario_id=? AND docente_id=? AND fecha=?
        LIMIT 1
        `,
        [horario_id, docente_id, todayStr]
      );

      if (dup.length) {
        return res.status(409).json({
          ok: false,
          msg: "already_registered",
          meta,
          fecha: todayStr,
        });
      }
    }

    await pool.query(
      `
      INSERT INTO asistencias
        (horario_id, docente_id, invitado_nombre, periodo_id, fecha, hora_registro, estado)
      VALUES
        (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        horario_id,
        docente_id || null,
        invitado_nombre || null,
        meta.periodo_id,
        todayStr,
        currentHHMM + ":00",
        "pendiente",
      ]
    );

    return res.json({
      ok: true,
      msg: "attendance_registered",
      meta,
      fecha: todayStr,
      hora: currentHHMM,
      estado: "pendiente",
      testMode,
    });
  } catch (err) {
    console.error("POST /horarios/qr/registrar:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

r.post(
  "/qr/registrar-evidencia",
  uploadEvidencia.fields([
    { name: "foto", maxCount: 1 },
    { name: "firma", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { codigo, docente_id } = req.body || {};
      const testMode = String(req.query?.test || req.body?.test || "") === "1";

      const foto = req.files?.foto?.[0];
      const firma = req.files?.firma?.[0];

      if (!codigo) return res.status(400).json({ ok: false, msg: "missing_code" });
      if (!docente_id) return res.status(400).json({ ok: false, msg: "missing_docente_id" });
      if (!foto) return res.status(400).json({ ok: false, msg: "missing_foto" });
      if (!firma) return res.status(400).json({ ok: false, msg: "missing_firma" });

      const [rows] = await pool.query(
        `
        SELECT 
          h.id,
          h.periodo_id,
          h.lab_id,
          h.dia,
          DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
          DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
          h.docente_id,
          p.nombre AS periodo_nombre,
          DATE_FORMAT(p.fecha_ini,'%Y-%m-%d') AS periodo_ini,
          DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS periodo_fin,
          l.nombre AS lab_nombre
        FROM horarios h
        JOIN periodos p ON p.id = h.periodo_id
        JOIN labs     l ON l.id = h.lab_id
        WHERE h.codigo_qr=? AND IFNULL(h.eliminado,0)=0 AND h.activo=1
        `,
        [codigo]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ ok: false, msg: "invalid_code" });
      }

const now = nowMX();
      const todayStr = now.toISOString().slice(0, 10);
      const currentHHMM = now.toTimeString().slice(0, 5);
      const currentDay = diaActualNumero(); // 1..7

      const meta = {
        periodo_id: rows[0].periodo_id,
        lab_id: rows[0].lab_id,
        periodo_ini: rows[0].periodo_ini,
        periodo_fin: rows[0].periodo_fin,
        periodo_nombre: rows[0].periodo_nombre,
        lab_nombre: rows[0].lab_nombre,
      };

      if (!isTodayBetween(meta.periodo_ini, meta.periodo_fin)) {
        return res.status(400).json({ ok: false, msg: "out_of_period", meta });
      }

      let rowsHoy = [];
      if (testMode) rowsHoy = rows;
      else {
        const diaFilter = currentDay >= 1 && currentDay <= 5 ? currentDay : null;
        rowsHoy = diaFilter
          ? rows.filter((r) => normalizarDiaDB(r.dia) === diaFilter)
          : [];
        if (!rowsHoy.length) {
          return res.status(400).json({ ok: false, msg: "no_class_today", meta });
        }
      }

      let bloquesHora = [];
      if (testMode) bloquesHora = rowsHoy;
      else {
        const tNow = toMin(currentHHMM);
        bloquesHora = rowsHoy.filter((r) => {
          const ini = toMin(r.hora_ini);
          const fin = toMin(r.hora_fin);
          return tNow >= ini && tNow < fin;
        });

        if (!bloquesHora.length) {
          return res.status(400).json({
            ok: false,
            msg: "out_of_schedule_time",
            meta,
            current_time: currentHHMM,
          });
        }
      }

      const docenteValido = bloquesHora.some(
        (b) => Number(b.docente_id) === Number(docente_id)
      );
      if (!docenteValido) {
        return res.status(403).json({ ok: false, msg: "wrong_teacher", meta });
      }

      const chosen =
        bloquesHora.find((b) => Number(b.docente_id) === Number(docente_id)) ||
        bloquesHora[0];

      const horario_id = chosen.id;

      const [dup] = await pool.query(
        `
        SELECT id FROM asistencias
        WHERE horario_id=? AND docente_id=? AND fecha=?
        LIMIT 1
        `,
        [horario_id, docente_id, todayStr]
      );
      if (dup.length) {
        return res.status(409).json({
          ok: false,
          msg: "already_registered",
          meta,
          fecha: todayStr,
        });
      }

      const foto_url = `/uploads/asistencias/${foto.filename}`;
      const firma_url = `/uploads/asistencias/${firma.filename}`;

// === CALCULAR ESTADO REAL ===
const iniMin = toMin(chosen.hora_ini);
const finMin = toMin(chosen.hora_fin);
const nowMin = toMin(currentHHMM);

let estadoFinal = "registrado";

if (nowMin > finMin) {
  estadoFinal = "tardio";
}

// === INSERT ===
const [ins] = await pool.query(
  `
  INSERT INTO asistencias
    (horario_id, docente_id, invitado_nombre, periodo_id, fecha, hora_registro, estado, foto_url, firma_url)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [
    horario_id,
    Number(docente_id),
    null,
    meta.periodo_id,
    todayStr,
    currentHHMM + ":00",
    estadoFinal,
    foto_url,
    firma_url,
  ]
);

      return res.json({
        ok: true,
        msg: "attendance_registered",
        asistencia_id: ins.insertId,
        meta,
        fecha: todayStr,
        hora: currentHHMM,
        estado: estadoFinal,
        foto_url,
        firma_url,
        testMode,
      });
    } catch (err) {
      console.error("POST /horarios/qr/registrar-evidencia:", err);
      res.status(500).json({ ok: false, msg: "server_error" });
    }
  }
);

/* =========================================================
   SANITY CHECK
   ========================================================= */

r.get("/", (_req, res) => {
  res.json({ ok: true, scope: "horarios" });
});

export default r;
