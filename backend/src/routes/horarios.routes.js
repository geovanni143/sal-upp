// backend/src/routes/horarios.routes.js
import { Router } from "express";
import { pool } from "../services/db.js";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

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
  return H * 60 + (M || 0);
};

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
 *
 * Devuelve:
 *  - ok: boolean
 *  - msg: string si hay error
 *  - codigo: string (4 dígitos) si ok
 *  - meta: { periodo_id, lab_id, periodo_nombre, periodo_ini, periodo_fin,
 *           lab_nombre, bloques_activos }
 */
async function ensureQrCodeForHorario(periodo_id, lab_id) {
  // 1) Verificar que existan bloques para esa combinación
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
    return {
      ok: false,
      msg: "no_blocks_for_combo",
    };
  }

  const r0 = rows[0];

  let codigo = r0.codigo_qr;

  // 2) Si no hay código, generamos uno único
  if (!codigo) {
    // Buscar un código que no exista en la tabla
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
      return {
        ok: false,
        msg: "cannot_generate_unique_code",
      };
    }

    // Guardar el mismo código en TODOS los bloques de esa combinación
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

/**
 * GET /api/horarios/catalogo
 *  - Lista de horarios agrupados por periodo+lab
 *  - Mismo formato que usa el catálogo de la vista HorariosPage
 */
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

/**
 * GET /api/horarios/catalogo/:periodo_id/:lab_id
 *  - Devuelve los bloques crudos de ese horario
 */
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

/**
 * DELETE lógico del horario (marca eliminado=1)
 */
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

/**
 * DELETE hard: borra definitivamente los bloques ya marcados como eliminados
 */
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

/**
 * RESTORE: marca eliminado=0 otra vez para esa combinación
 */
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
   Guarda la semana completa (borra y vuelve a insertar)
   Body: { periodo_id, lab_id, upserts: [ ...bloques... ],
           from_periodo_id?, from_lab_id? }
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

    // Si se está "moviendo" el horario desde otra combinación, limpiamos la anterior
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

    // Limpiar horario destino actual (full replace)
    await conn.query(
      `
      DELETE FROM horarios
      WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0
      `,
      [periodo_id, lab_id]
    );

    // Insertar de nuevo todos los bloques
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
          b.activo ? 1 : 1,
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
   GET /api/horarios/pdf
   Genera PDF del horario completo (semana)
   Query: periodo_id, lab_id
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

    // Mapear por día y hora para buscar rápido
    const bloques = rows.map((b) => ({
      dia: normalizarDiaDB(b.dia),
      hora_ini: b.hora_ini,
      hora_fin: b.hora_fin,
      materia: b.materia,
      codigo: b.codigo,
      grupo: b.grupo,
      docente_nombre: b.docente_nombre,
    }));

    const cellBloque = (dia, hhmm) =>
      bloques.find(
        (b) =>
          Number(b.dia) === Number(dia) &&
          b.hora_ini <= hhmm &&
          b.hora_fin > hhmm
      ) || null;

    const doc = new PDFDocument({
      size: "LETTER",
      margin: 30,
      layout: "landscape",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="horario-${periodo_id}-${lab_id}.pdf"`
    );

    doc.pipe(res);

    // Encabezado
    doc.fontSize(14).text("UNIVERSIDAD POLITÉCNICA DE PACHUCA", {
      align: "center",
    });
    doc.moveDown(0.4);
    doc.fontSize(12).text("HORARIO DE LABORATORIO", { align: "center" });
    doc.moveDown(0.4);

    const tituloPeriodo = p ? `${p.nombre} (${p.ini} — ${p.fin})` : "";
    const tituloLab = l ? `Laboratorio: ${l.nombre}` : "";

    if (tituloPeriodo) {
      doc.fontSize(10).text(tituloPeriodo, { align: "center" });
    }
    if (tituloLab) {
      doc.fontSize(10).text(tituloLab, { align: "center" });
    }

    doc.moveDown(1);

    // Tabla sencilla
    const startX = 40;
    let y = doc.y;
    const colWidthHora = 60;
    const colWidthDia = (doc.page.width - startX * 2 - colWidthHora) / 5;

    doc.fontSize(8);

    // Header row
    doc.text("Hora", startX, y, { width: colWidthHora, align: "center" });
    const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    dias.forEach((d, idx) => {
      doc.text(
        d,
        startX + colWidthHora + colWidthDia * idx,
        y,
        { width: colWidthDia, align: "center" }
      );
    });

    y += 18;
    doc.moveTo(startX, y - 2).lineTo(doc.page.width - startX, y - 2).stroke();

    // Filas de horas
    horasMedias.forEach((hhmm) => {
      if (y > doc.page.height - 40) {
        doc.addPage();
        y = 40;
      }

      doc.text(hhmm, startX, y, {
        width: colWidthHora,
        align: "center",
      });

      for (let d = 1; d <= 5; d++) {
        const b = cellBloque(d, hhmm);
        if (b) {
          const labelParts = [];
          if (b.materia) labelParts.push(b.materia);
          if (b.codigo) labelParts.push(b.codigo);
          if (b.grupo) labelParts.push(`Grupo: ${b.grupo}`);
          if (b.docente_nombre) labelParts.push(b.docente_nombre);

          doc.text(
            labelParts.join(" · "),
            startX + colWidthHora + colWidthDia * (d - 1),
            y,
            { width: colWidthDia, align: "left" }
          );
        }
      }

      y += 14;
      doc.moveTo(startX, y - 2).lineTo(doc.page.width - startX, y - 2).stroke();
    });

    doc.end();
  } catch (err) {
    console.error("GET /horarios/pdf:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});
/* =========================================================
   LISTA DE HORARIOS PARA GENERAR QR
   GET /api/horarios/lista
   - Devuelve 1 ítem por combinación periodo+lab
   - Formato igual que catálogo
   ========================================================= */

r.get("/lista", async (_req, res) => {
  try {
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
        MIN(h.codigo_qr) AS codigo_qr
      FROM horarios h
      JOIN periodos p ON p.id = h.periodo_id
      JOIN labs     l ON l.id = h.lab_id
      WHERE IFNULL(h.eliminado,0)=0
      GROUP BY h.periodo_id, h.lab_id
      ORDER BY p.fecha_ini DESC, l.nombre ASC
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
   GENERAR CÓDIGO (4 dígitos) + QR POR HORARIO (periodo+lab)
   POST /api/horarios/generar-qr
   body: { periodo_id, lab_id }
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

    // payload que va dentro del QR
    const payload = {
      scope: "sal-upp-horario",
      version: 1,
      codigo, // código de 4 dígitos
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
   PDF SOLO DE QR PARA EL HORARIO (periodo+lab)
   GET /api/horarios/qr-pdf?periodo_id=&lab_id=
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
    const base64 = qrDataUrl.split(",")[1];
    const imgBuffer = Buffer.from(base64, "base64");

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="qr-horario-${periodo_id}-${lab_id}.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(12).text("UNIVERSIDAD POLITÉCNICA DE PACHUCA", {
      align: "center",
    });
    doc.moveDown(0.3);
    doc.fontSize(11).text("CÓDIGO QR PARA REGISTRO DE ASISTENCIA", {
      align: "center",
    });

    doc.moveDown(0.4);
    doc
      .fontSize(10)
      .text(
        `Periodo: ${meta.periodo_nombre} (${meta.periodo_ini} — ${meta.periodo_fin})`,
        { align: "center" }
      );
    doc
      .fontSize(10)
      .text(`Laboratorio: ${meta.lab_nombre}`, { align: "center" });

    doc.moveDown(1);
    doc.fontSize(11).text(`Código de horario: ${codigo}`, {
      align: "center",
    });

    doc.moveDown(2);

    const qrSize = 260;
    const x = (doc.page.width - qrSize) / 2;
    doc.image(imgBuffer, x, doc.y, { width: qrSize });

    doc.moveDown(2);
    doc.fontSize(42).text(codigo, { align: "center" });

    doc.end();
  } catch (err) {
    console.error("GET /horarios/qr-pdf:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   VALIDAR ESCANEO DE QR
   POST /api/horarios/qr/validar-escaneo
   body: { codigo, docente_id?, lab_id? }
   - Verifica:
     * que el código exista
     * que hoy esté dentro del periodo
     * que el día y hora actual estén en algún bloque
     * que (opcional) el docente coincida con el dueño del bloque
   ========================================================= */

r.post("/qr/validar-escaneo", async (req, res) => {
  try {
    const { codigo, docente_id, lab_id } = req.body || {};
    if (!codigo) {
      return res.status(400).json({ ok: false, msg: "missing_code" });
    }

    const [rows] = await pool.query(
      `
      SELECT 
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

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentHHMM = now.toTimeString().slice(0, 5);
    const currentDay = diaActualNumero(); // 1..7

    // Meta general del primer registro
    const meta = {
      periodo_id: rows[0].periodo_id,
      lab_id: rows[0].lab_id,
      periodo_nombre: rows[0].periodo_nombre,
      periodo_ini: rows[0].periodo_ini,
      periodo_fin: rows[0].periodo_fin,
      lab_nombre: rows[0].lab_nombre,
    };

    // 1) Validar que hoy está dentro del periodo
    if (!isTodayBetween(meta.periodo_ini, meta.periodo_fin)) {
      return res.status(400).json({
        ok: false,
        msg: "out_of_period",
        meta,
      });
    }

    // 2) Filtrar solo bloques del día actual (si es 1..5)
    const diaFilter = currentDay >= 1 && currentDay <= 5 ? currentDay : null;
    const rowsHoy = diaFilter
      ? rows.filter((r) => normalizarDiaDB(r.dia) === diaFilter)
      : [];

    if (!rowsHoy || rowsHoy.length === 0) {
      return res.status(400).json({
        ok: false,
        msg: "no_class_today",
        meta,
      });
    }

    // 3) Validar que la hora actual caiga dentro de algún bloque
    const tNow = toMin(currentHHMM);
    const bloquesHora = rowsHoy.filter((r) => {
      const ini = toMin(r.hora_ini);
      const fin = toMin(r.hora_fin);
      return tNow >= ini && tNow < fin;
    });

    if (!bloquesHora || bloquesHora.length === 0) {
      return res.status(400).json({
        ok: false,
        msg: "out_of_schedule_time",
        meta,
        current_time: currentHHMM,
      });
    }

    // 4) Validar docente opcional
    let docenteValido = true;
    if (docente_id) {
      docenteValido = bloquesHora.some(
        (b) => Number(b.docente_id) === Number(docente_id)
      );
      if (!docenteValido) {
        return res.status(403).json({
          ok: false,
          msg: "wrong_teacher",
          meta,
        });
      }
    }

    // 5) Validar lab opcional
    if (lab_id && Number(lab_id) !== Number(meta.lab_id)) {
      return res.status(400).json({
        ok: false,
        msg: "wrong_lab",
        meta,
      });
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
   SANITY CHECK
   ========================================================= */

r.get("/", (_req, res) => {
  res.json({ ok: true, scope: "horarios" });
});

export default r;
