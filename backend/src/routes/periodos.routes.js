import { Router } from "express";
import { pool } from "../services/db.js";     // usa el mismo pool que en users/labs
import log from "../middlewares/bitacora.js"; // si aún no lo usas, puedes quitar log(...)

const r = Router();

/* Helpers */
async function getById(id) {
  // Fechas normalizadas a 'YYYY-MM-DD' para no mandar hora
  const [rows] = await pool.query(
    `SELECT  id,
             nombre,
             DATE_FORMAT(fecha_ini,'%Y-%m-%d')  AS fecha_ini,
             DATE_FORMAT(fecha_fin,'%Y-%m-%d')  AS fecha_fin,
             activo,
             eliminado,
             eliminado_en
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
              activo,
              eliminado,
              eliminado_en
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

    const [rs] = await pool.execute(
      "INSERT INTO periodos (nombre,fecha_ini,fecha_fin,activo,eliminado,eliminado_en) VALUES (?,?,?,1,0,NULL)",
      [nombre.trim(), fecha_ini, fecha_fin]
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
    const { nombre, fecha_ini, fecha_fin, activo = 1 } = req.body || {};
    if (!id || !nombre?.trim() || !fecha_ini || !fecha_fin) {
      return res.status(400).json({ error: "Datos inválidos" });
    }
    const cur = await getById(id);
    if (!cur || cur.eliminado) return res.status(404).json({ error: "No encontrado" });

    if (new Date(fecha_ini) > new Date(fecha_fin)) {
      return res.status(400).json({ error: "La fecha inicio no puede ser mayor que la fecha fin" });
    }

    await pool.execute(
      "UPDATE periodos SET nombre=?, fecha_ini=?, fecha_fin=?, activo=? WHERE id=?",
      [nombre.trim(), fecha_ini, fecha_fin, +!!activo, id]
    );

    const row = await getById(id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar", detail: e.message });
  }
});

/* TOGGLE ACTIVO — exponemos /activo y /active para compatibilidad */
async function toggleHandler(req, res) {
  try {
    const id = Number(req.params.id);
    const cur = await getById(id);
    if (!cur || cur.eliminado) return res.status(404).json({ error: "No encontrado" });

    const nuevo = cur.activo ? 0 : 1;
    await pool.execute("UPDATE periodos SET activo=? WHERE id=?", [nuevo, id]);

    const row = await getById(id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Error al cambiar estado", detail: e.message });
  }
}
r.patch("/:id/activo", log("periodos:toggle"), toggleHandler);
r.patch("/:id/active", log("periodos:toggle"), toggleHandler); // alias

/* SOFT-DELETE — bloquea si hay horarios vinculados (FK común) */
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

    await pool.execute(
      "UPDATE periodos SET eliminado=0, eliminado_en=NULL, activo=1 WHERE id=?",
      [id]
    );
    const row = await getById(id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Error al restaurar", detail: e.message });
  }
});

export default r;
