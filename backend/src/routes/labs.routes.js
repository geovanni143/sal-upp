import { Router } from "express";
import db from "../services/db.js";
import { softDelete } from "../services/softDelete.js";

const r = Router();

/** LISTAR: por defecto NO trae eliminados. Usa ?includeDeleted=1 para verlos. */
r.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const includeDeleted = req.query.includeDeleted == "1";
    const where = [];
    const params = [];

    if (!includeDeleted) { where.push("eliminado=0"); }
    if (q) { where.push(`CONCAT_WS(' ', nombre, encargado, descripcion) LIKE ?`); params.push(`%${q}%`); }

    const sql =
      `SELECT id, nombre, encargado, descripcion, activo, eliminado, deleted_at
         FROM laboratorios
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY nombre ASC`;

    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

/** CREAR (siempre eliminado=0) */
r.post("/", async (req, res, next) => {
  try {
    const { nombre, encargado = "", descripcion = "" } = req.body || {};
    if (!nombre) return res.status(400).json({ error: "'nombre' es requerido." });

    const { insertId } = await db.exec(
      `INSERT INTO laboratorios (nombre, encargado, descripcion, activo, eliminado, deleted_at)
       VALUES (?,?,?,?,0,NULL)`,
      [nombre.trim(), encargado.trim(), descripcion || "", 1]
    );
    const row = await db.queryOne(
      `SELECT id, nombre, encargado, descripcion, activo, eliminado, deleted_at
         FROM laboratorios WHERE id=?`, [insertId]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

/** EDITAR (no toca eliminado/deleted_at) */
r.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nombre, encargado = "", descripcion = "" } = req.body || {};
    if (!id || !nombre) return res.status(400).json({ error: "Datos inválidos." });

    await db.exec(
      `UPDATE laboratorios SET nombre=?, encargado=?, descripcion=? WHERE id=?`,
      [nombre.trim(), encargado.trim(), descripcion || "", id]
    );
    const row = await db.queryOne(
      `SELECT id, nombre, encargado, descripcion, activo, eliminado, deleted_at
         FROM laboratorios WHERE id=?`, [id]
    );
    res.json(row);
  } catch (err) { next(err); }
});

/** TOGGLE ACTIVO (solo si no está eliminado) */
r.patch("/:id/activo", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cur = await db.queryOne(
      `SELECT activo, eliminado FROM laboratorios WHERE id=?`, [id]
    );
    if (!cur) return res.status(404).json({ error: "Laboratorio no encontrado" });
    if (cur.eliminado) return res.status(409).json({ error: "No permitido en registros eliminados" });

    const nuevo = cur.activo ? 0 : 1;
    await db.exec(`UPDATE laboratorios SET activo=? WHERE id=?`, [nuevo, id]);

    const out = await db.queryOne(
      `SELECT id, nombre, encargado, descripcion, activo, eliminado, deleted_at
         FROM laboratorios WHERE id=?`, [id]
    );
    res.json(out);
  } catch (err) { next(err); }
});

/** SOFT DELETE (oculta del frontend) */
r.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // (Opcional) bloquear si tiene horarios vigentes NO eliminados:
    // Detecta columna FK en horarios
    const candidates = ["lab_id", "laboratorio_id", "id_laboratorio", "id_lab", "laboratorio"];
    const cols = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='horarios'
          AND COLUMN_NAME IN (${candidates.map(() => "?").join(",")})`,
      candidates
    );
    if (cols.length) {
      const fk = cols[0].COLUMN_NAME;
      const rel = await db.queryOne(
        `SELECT COUNT(*) AS n FROM horarios WHERE \`${fk}\`=? AND (eliminado=0 OR eliminado IS NULL)`,
        [id]
      );
      if (rel?.n > 0) {
        return res.status(409).json({
          error: "No se puede eliminar",
          code: "LAB_HAS_SCHEDULES",
          reason: `Existen ${rel.n} horarios vigentes vinculados.`
        });
      }
    }

    await softDelete("laboratorios", "id", id);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

/** RESTAURAR (opcional) */
r.patch("/:id/restaurar", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.exec(`UPDATE laboratorios SET eliminado=0, deleted_at=NULL WHERE id=?`, [id]);
    const row = await db.queryOne(
      `SELECT id, nombre, encargado, descripcion, activo, eliminado, deleted_at
         FROM laboratorios WHERE id=?`, [id]
    );
    res.json(row);
  } catch (err) { next(err); }
});

export default r;
