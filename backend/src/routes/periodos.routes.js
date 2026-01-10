import { Router } from "express";
import { pool } from "../services/db.js";
import log from "../middlewares/bitacora.js";

const r = Router();

/* Helpers */
async function getById(id) {
  const [rows] = await pool.query(
    `
    SELECT  id,
            nombre,
            DATE_FORMAT(fecha_ini,'%Y-%m-%d')  AS fecha_ini,
            DATE_FORMAT(fecha_fin,'%Y-%m-%d')  AS fecha_fin,
            eliminado,
            eliminado_en,
            /* Estado automático */
            CASE
              WHEN eliminado = 1 THEN 'ELIMINADO'
              WHEN CURDATE() < fecha_ini THEN 'PROXIMO'
              WHEN CURDATE() > fecha_fin THEN 'FINALIZADO'
              ELSE 'EN_CURSO'
            END AS estado,
            /* Activo automático */
            CASE
              WHEN eliminado = 1 THEN 0
              WHEN CURDATE() BETWEEN fecha_ini AND fecha_fin THEN 1
              ELSE 0
            END AS activo
      FROM periodos
     WHERE id=?`,
    [id]
  );
  return rows[0] || null;
}

/* LISTAR — ?q= & ?includeDeleted=1 o ?incl_del=1 */
r.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const includeDeleted =
      req.query.includeDeleted === "1" || req.query.incl_del === "1";

    const where = [];
    const vals = [];

    if (!includeDeleted) where.push("eliminado=0");
    if (q) {
      where.push(`( nombre LIKE ?
                   OR DATE_FORMAT(fecha_ini,'%Y-%m-%d') LIKE ?
                   OR DATE_FORMAT(fecha_fin,'%Y-%m-%d') LIKE ? )`);
      vals.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const sql = `
      SELECT  id,
              nombre,
              DATE_FORMAT(fecha_ini,'%Y-%m-%d')  AS fecha_ini,
              DATE_FORMAT(fecha_fin,'%Y-%m-%d')  AS fecha_fin,
              eliminado,
              eliminado_en,
              /* Estado automático */
              CASE
                WHEN eliminado = 1 THEN 'ELIMINADO'
                WHEN CURDATE() < fecha_ini THEN 'PROXIMO'
                WHEN CURDATE() > fecha_fin THEN 'FINALIZADO'
                ELSE 'EN_CURSO'
              END AS estado,
              /* Activo automático */
              CASE
                WHEN eliminado = 1 THEN 0
                WHEN CURDATE() BETWEEN fecha_ini AND fecha_fin THEN 1
                ELSE 0
              END AS activo
        FROM periodos
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY fecha_ini DESC, id DESC`;

    const [rows] = await pool.query(sql, vals);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Error al listar periodos", detail: e.message });
  }
});

/* CREAR */
r.post("/", log("periodos:create"), async (req, res) => {
  try {
    const { nombre, fecha_ini, fecha_fin } = req.body || {};
    if (!nombre?.trim() || !fecha_ini || !fecha_fin) {
      return res.status(400).json({ error: "Nombre/fechas obligatorios" });
    }
    if (new Date(fecha_ini) > new Date(fecha_fin)) {
      return res.status(400).json({ error: "La fecha inicio no puede ser mayor que la fecha fin" });
    }

    // activo en DB: 1 solo si hoy está dentro del rango, si no 0
    const [rs] = await pool.execute(
      `
      INSERT INTO periodos (nombre,fecha_ini,fecha_fin,activo,eliminado,eliminado_en)
      VALUES (
        ?, ?, ?,
        CASE WHEN CURDATE() BETWEEN ? AND ? THEN 1 ELSE 0 END,
        0, NULL
      )`,
      [nombre.trim(), fecha_ini, fecha_fin, fecha_ini, fecha_fin]
    );

    const row = await getById(rs.insertId);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: "Error al crear periodo", detail: e.message });
  }
});

/* ACTUALIZAR */
r.put("/:id", log("periodos:update"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, fecha_ini, fecha_fin } = req.body || {};
    if (!id || !nombre?.trim() || !fecha_ini || !fecha_fin) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const cur = await getById(id);
    if (!cur || cur.eliminado) return res.status(404).json({ error: "No encontrado" });

    if (new Date(fecha_ini) > new Date(fecha_fin)) {
      return res.status(400).json({ error: "La fecha inicio no puede ser mayor que la fecha fin" });
    }

    await pool.execute(
      `
      UPDATE periodos
         SET nombre=?,
             fecha_ini=?,
             fecha_fin=?,
             activo = CASE WHEN CURDATE() BETWEEN ? AND ? THEN 1 ELSE 0 END
       WHERE id=?`,
      [nombre.trim(), fecha_ini, fecha_fin, fecha_ini, fecha_fin, id]
    );

    const row = await getById(id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar", detail: e.message });
  }
});

/* YA NO EXISTE TOGGLE MANUAL (compatibilidad) */
async function toggleDeprecated(_req, res) {
  return res.status(400).json({
    error: "Acción no permitida: el estado es automático por fechas (inicio/fin).",
    code: "PERIODO_AUTO_ESTADO",
  });
}
r.patch("/:id/activo", log("periodos:toggle"), toggleDeprecated);
r.patch("/:id/active", log("periodos:toggle"), toggleDeprecated);

/* SOFT-DELETE — bloquea si hay horarios vinculados */
r.delete("/:id", log("periodos:delete"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = await getById(id);
    if (!cur) return res.status(404).json({ error: "No encontrado" });
    if (cur.eliminado) return res.sendStatus(204);

    const posibles = ["periodo_id", "id_periodo", "per_id"];
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'horarios'
          AND COLUMN_NAME IN (${posibles.map(() => "?").join(",")})`,
      posibles
    );

    if (cols.length) {
      const fk = cols[0].COLUMN_NAME;
      const [[{ n }]] = await pool.query(
        `SELECT COUNT(*) n
           FROM horarios
          WHERE \`${fk}\`=? AND (eliminado=0 OR eliminado IS NULL)`,
        [id]
      );
      if (n > 0) {
        return res.status(409).json({
          error: "No se puede eliminar: hay horarios vinculados",
          code: "PERIODO_HAS_SCHEDULES",
          reason: `Existen ${n} horarios vigentes asociados.`,
        });
      }
    }

    await pool.execute(
      "UPDATE periodos SET eliminado=1, eliminado_en=NOW(), activo=0 WHERE id=?",
      [id]
    );
    res.sendStatus(204);
  } catch (e) {
    res.status(500).json({ error: "Error al eliminar", detail: e.message });
  }
});

/* RESTAURAR */
r.patch("/:id/restaurar", log("periodos:restore"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = await getById(id);
    if (!cur) return res.status(404).json({ error: "No encontrado" });

    // Al restaurar: eliminado=0, y activo en DB se recalcula
    await pool.execute(
      `
      UPDATE periodos
         SET eliminado=0,
             eliminado_en=NULL,
             activo = CASE WHEN CURDATE() BETWEEN fecha_ini AND fecha_fin THEN 1 ELSE 0 END
       WHERE id=?`,
      [id]
    );

    const row = await getById(id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Error al restaurar", detail: e.message });
  }
});

export default r;
