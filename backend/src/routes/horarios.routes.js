// backend/src/routes/horarios.routes.js
import { Router } from "express";
import { pool } from "../services/db.js";
import PDFDocument from "pdfkit";

const r = Router();

/* ================= Helpers ================= */

const HHMM = (s) => (s || "").slice(0, 5); // "08:30"
const HHMMSS = (s) => `${HHMM(s)}:00`;

function isTodayBetween(iniStr, finStr) {
  if (!iniStr || !finStr) return false;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  return todayStr >= iniStr && todayStr <= finStr;
}

// normalizar día 'lu','ma','1','2' → 1..5
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

// Horas medias para tabla y PDF (7:00–18:30)
const horasMedias = (() => {
  const out = [];
  const pad = (n) => String(n).padStart(2, "0");
  for (let H = 7; H < 19; H++) {
    out.push(`${pad(H)}:00`);
    out.push(`${pad(H)}:30`);
  }
  return out;
})();

/* =========================================================
   GET /api/horarios/catalogo
   ========================================================= */
r.get("/catalogo", async (req, res) => {
  try {
    const { search = "", mostrar_eliminados = "0" } = req.query;
    const showDeleted = Number(mostrar_eliminados) === 1;

    const filtros = [];
    const params = [];

    if (showDeleted) {
      filtros.push("IFNULL(h.eliminado,0) = 1");
    } else {
      filtros.push("IFNULL(h.eliminado,0) = 0");
    }

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
        p.nombre AS periodo_nombre,
        DATE_FORMAT(p.fecha_ini,'%Y-%m-%d') AS periodo_ini,
        DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS periodo_fin,
        h.lab_id,
        l.nombre AS lab_nombre,
        COUNT(*) AS bloques_activos,
        MIN(IFNULL(h.activo,0)) AS activo_flag
      FROM horarios h
      JOIN periodos p ON p.id = h.periodo_id
      JOIN labs     l ON l.id = h.lab_id
      ${where}
      GROUP BY h.periodo_id, h.lab_id
      ORDER BY p.fecha_ini DESC, l.nombre ASC
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

/* =========================================================
   GET /api/horarios/catalogo/:periodo_id/:lab_id
   ========================================================= */
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
   PATCH activar / desactivar
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

    if (!p) {
      return res.json({ ok: false, msg: "Periodo no encontrado" });
    }

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

/* =========================================================
   DELETE lógico /catalogo/:periodo_id/:lab_id
   ========================================================= */
r.delete("/catalogo/:periodo_id/:lab_id", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    const [[p]] = await pool.query(
      `SELECT DATE_FORMAT(fecha_ini,'%Y-%m-%d') AS ini,
              DATE_FORMAT(fecha_fin,'%Y-%m-%d') AS fin
       FROM periodos WHERE id=?`,
      [periodo_id]
    );

    if (!p) {
      return res.json({ ok: false, msg: "Periodo no encontrado" });
    }

    if (isTodayBetween(p.ini, p.fin)) {
      return res.json({
        ok: false,
        msg: "No puedes eliminar un horario mientras el período está en curso.",
      });
    }

    await pool.query(
      `UPDATE horarios SET eliminado=1 
       WHERE periodo_id=? AND lab_id=?`,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, msg: "Horario eliminado." });
  } catch (err) {
    console.error("DELETE horario:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   DELETE duro /catalogo/:periodo_id/:lab_id/hard
   ========================================================= */
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

/* =========================================================
   POST /restore
   ========================================================= */
r.post("/catalogo/:periodo_id/:lab_id/restore", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    await pool.query(
      `UPDATE horarios SET eliminado=0 
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
    return res.status(400).json({ ok: false, msg: "missing_ids" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const lista = Array.isArray(upserts) ? upserts : [];

    // Validación: conflicto de docente en OTROS labs
    for (const b of lista) {
      if (!b || !b.docente_id) continue;

      const dia = normalizarDiaDB(b.dia);
      const ini = HHMMSS(b.hora_ini);
      const fin = HHMMSS(b.hora_fin);

      const [rows] = await conn.query(
        `
        SELECT 
          h.dia,
          DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
          DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
          l.nombre AS lab_nombre,
          p.nombre AS periodo_nombre
        FROM horarios h
        JOIN labs     l ON l.id = h.lab_id
        JOIN periodos p ON p.id = h.periodo_id
        WHERE h.periodo_id = ?
          AND h.lab_id <> ?
          AND IFNULL(h.eliminado,0)=0
          AND h.docente_id = ?
          AND h.dia = ?
          AND NOT (h.hora_fin <= ? OR h.hora_ini >= ?)
        LIMIT 1
        `,
        [periodo_id, lab_id, b.docente_id, dia, ini, fin]
      );

      if (rows.length > 0) {
        const c = rows[0];
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          msg: `Conflicto de horario: el docente ya tiene una clase en "${c.periodo_nombre} — ${c.lab_nombre}", ${nombreDia(
            c.dia
          )} de ${c.hora_ini} a ${c.hora_fin}.`,
        });
      }
    }

    // Si se está moviendo el horario, borrar el origen
    if (
      from_periodo_id &&
      from_lab_id &&
      (Number(from_periodo_id) !== Number(periodo_id) ||
        Number(from_lab_id) !== Number(lab_id))
    ) {
      await conn.query(
        `DELETE FROM horarios WHERE periodo_id=? AND lab_id=?`,
        [from_periodo_id, from_lab_id]
      );
    }

    // Borrar horario actual de este lab/periodo y recrear
    await conn.query(
      `DELETE FROM horarios WHERE periodo_id=? AND lab_id=?`,
      [periodo_id, lab_id]
    );

    if (lista.length) {
      const ph = [];
      const val = [];

      for (const b of lista) {
        if (!b) continue;
        const {
          dia,
          hora_ini,
          hora_fin,
          materia = null,
          codigo = null,
          grupo = null,
          docente_id = null,
        } = b;

        if (dia == null || !hora_ini || !hora_fin) continue;

        ph.push(`(?,?,?,?,?,?,?,?,?,1,0,NOW())`);
        val.push(
          periodo_id,
          lab_id,
          normalizarDiaDB(dia),
          HHMMSS(hora_ini),
          HHMMSS(hora_fin),
          materia,
          codigo,
          grupo,
          docente_id
        );
      }

      if (ph.length) {
        await conn.query(
          `
          INSERT INTO horarios
          (periodo_id, lab_id, dia, hora_ini, hora_fin,
           materia, codigo, grupo, docente_id, activo, eliminado, created_at)
          VALUES ${ph.join(",")}
          `,
          val
        );
      }
    }

    await conn.commit();
    res.json({ ok: true, msg: "Horario guardado" });
  } catch (err) {
    console.error("POST /horarios/bulk:", err);
    await conn.rollback();
    res
      .status(400)
      .json({ ok: false, msg: err.message || "bulk_failed" });
  } finally {
    conn.release();
  }
});

/* =========================================================
   GET /api/horarios/pdf?periodo_id=&lab_id=
   Genera PDF con tabla llena:
   - solo horas realmente usadas
   - 1+ páginas si hace falta
   - altura de fila dinámica para textos largos
   ========================================================= */
r.get("/pdf", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.query;
    if (!periodo_id || !lab_id) {
      return res.status(400).json({ ok: false, msg: "missing_ids" });
    }

    const [[p]] = await pool.query(
      `SELECT nombre,
              DATE_FORMAT(fecha_ini,'%Y-%m-%d') AS ini,
              DATE_FORMAT(fecha_fin,'%Y-%m-%d') AS fin
       FROM periodos WHERE id=?`,
      [periodo_id]
    );
    const [[l]] = await pool.query(
      `SELECT nombre FROM labs WHERE id=?`,
      [lab_id]
    );

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

    const bloques = rows.map((b) => ({
      ...b,
      dia: normalizarDiaDB(b.dia),
      hora_ini: HHMM(b.hora_ini),
      hora_fin: HHMM(b.hora_fin),
      docente_nombre: b.docente_nombre || "",
    }));

    // ---- Determinar rango de horas realmente usadas ----
    let horasUsadas = horasMedias;
    if (bloques.length) {
      const idxs = [];
      for (const b of bloques) {
        // Marcamos TODAS las medias horas donde la clase está activa
        for (let i = 0; i < horasMedias.length; i++) {
          const h = horasMedias[i];
          if (h >= b.hora_ini && h < b.hora_fin) {
            idxs.push(i);
          }
        }
      }
      if (idxs.length) {
        const minIdx = Math.max(0, Math.min(...idxs));
        const maxIdx = Math.min(horasMedias.length - 1, Math.max(...idxs));
        horasUsadas = horasMedias.slice(minIdx, maxIdx + 1);
      }
    }

    // Helper: buscar bloque en una media hora
    const findBloque = (dia, hhmm) =>
      bloques.find(
        (x) => x.dia === dia && x.hora_ini <= hhmm && x.hora_fin > hhmm
      ) || null;

    // ---- PDF ----
    const margin = 40;
    const doc = new PDFDocument({
      size: "LETTER",
      margin,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="horario-${periodo_id}-${lab_id}.pdf"`
    );
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const usableWidth = pageWidth - margin * 2;
    const colHoraW = 60;
    const colDiaW = (usableWidth - colHoraW) / 5;
    const baseRowH = 28; // mínimo por fila
    const diasHeaders = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"];

    // Encabezado principal (solo en la primera página)
    doc.fontSize(11).text("UNIVERSIDAD POLITÉCNICA DE PACHUCA", {
      align: "center",
    });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .text("HORARIO DE CLASES POR ESPACIOS EDUCATIVOS", {
        align: "center",
      });
    doc.moveDown(0.2);
    if (p) {
      doc
        .fontSize(9)
        .text(`${p.nombre} (${p.ini} — ${p.fin})`, { align: "center" });
    }
    if (l) {
      doc.moveDown(0.2);
      doc.fontSize(9).text(`HORARIO DE ${l.nombre}`, { align: "center" });
    }
    doc.moveDown(1);

    // Encabezado de tabla (cada página)
    const drawTableHeader = () => {
      const y = doc.y;
      const startX = margin;
      const rowHHeader = 26;
      const tableWidth = colHoraW + 5 * colDiaW;

      doc.fontSize(8).text("HORA", startX + 4, y + 9, {
        width: colHoraW - 8,
        align: "center",
      });

      diasHeaders.forEach((d, idx) => {
        const x = startX + colHoraW + idx * colDiaW;
        doc.text(d, x + 4, y + 9, {
          width: colDiaW - 8,
          align: "center",
        });
      });

      doc.rect(startX, y, tableWidth, rowHHeader).stroke();
      return y + rowHHeader;
    };

    let y = drawTableHeader();
    const bottomLimit = doc.page.height - margin;

    // ---- Filas de horario (altura dinámica) ----
    for (const hhmm of horasUsadas) {
      const startX = margin;

      // 1) Precalcular textos de cada celda y altura requerida
      const cellTexts = {};
      let maxCellHeight = 0;

      for (let d = 1; d <= 5; d++) {
        const b = findBloque(d, hhmm);
        if (!b) {
          cellTexts[d] = "";
          continue;
        }

        const partes = [];

        if (b.materia || b.codigo) {
          const linea1 = [b.materia, b.codigo]
            .filter(Boolean)
            .join(" — ");
          partes.push(linea1);
        }
        if (b.grupo) {
          partes.push(`Grupo: ${b.grupo}`);
        }
        if (b.docente_nombre) {
          partes.push(`Imparte: ${b.docente_nombre}`);
        }

        const text = partes.join("\n");
        cellTexts[d] = text;

        if (text) {
          doc.fontSize(7);
          const hText = doc.heightOfString(text, {
            width: colDiaW - 6,
          });
          if (hText > maxCellHeight) maxCellHeight = hText;
        }
      }

      // Altura final de la fila (mínimo baseRowH)
      const rowH = Math.max(baseRowH, maxCellHeight + 6); // + padding

      // 2) Salto de página si no cabe esta fila completa
      if (y + rowH > bottomLimit) {
        doc.addPage();
        doc.moveDown(0.5);
        y = drawTableHeader();
      }

      // 3) Dibujar la fila (hora + celdas)
      // Columna hora
      doc.rect(startX, y, colHoraW, rowH).stroke();
      doc.fontSize(8).text(hhmm, startX + 6, y + 9, {
        width: colHoraW - 10,
        align: "left",
      });

      // Celdas de días
      for (let d = 1; d <= 5; d++) {
        const x = startX + colHoraW + (d - 1) * colDiaW;
        doc.rect(x, y, colDiaW, rowH).stroke();

        const text = cellTexts[d];
        if (!text) continue;

        doc.fontSize(7).text(text, x + 3, y + 3, {
          width: colDiaW - 6,
          // sin "height" para no recortar, ya ajustamos rowH arriba
        });
      }

      y += rowH;
    }

    doc.end();
  } catch (err) {
    console.error("GET /horarios/pdf:", err);
    res.status(500).end();
  }
});

/* =========================================================
   Sanity check
   ========================================================= */
r.get("/", (_req, res) => {
  res.json({ ok: true, scope: "horarios" });
});

export default r;
