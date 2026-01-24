// backend/src/routes/parametros.routes.js
import { Router } from "express";
import { pool } from "../services/db.js";

const r = Router();

const okScopes = new Set(["GLOBAL", "ROL", "LAB", "PERIODO", "USUARIO"]);
const okTipos = new Set(["string", "int", "float", "bool", "json"]);

const norm = (s) => String(s ?? "").trim();

function asIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function validateTipoValor(tipo, valor) {
  const t = String(tipo || "string").toLowerCase();

  if (!okTipos.has(t)) return `Tipo inválido: ${tipo}`;

  if (t === "bool") {
    const s = String(valor ?? "").toLowerCase().trim();
    if (!["true", "false", "1", "0", "si", "sí", "no"].includes(s)) {
      return "Bool inválido (usa true/false)";
    }
  }
  if (t === "int") {
    const n = Number(valor);
    if (!Number.isInteger(n)) return "Int inválido";
  }
  if (t === "float") {
    const n = Number(valor);
    if (Number.isNaN(n)) return "Float inválido";
  }
  if (t === "json") {
    try {
      JSON.parse(String(valor ?? ""));
    } catch {
      return "JSON inválido";
    }
  }
  return "";
}

async function auditInsert(conn, { parametro_id, accion, before_json, after_json, actor_user_id }) {
  await conn.query(
    `INSERT INTO parametros_audit (parametro_id, accion, before_json, after_json, actor_user_id)
     VALUES (?, ?, ?, ?, ?)`,
    [parametro_id, accion, before_json, after_json, actor_user_id]
  );
}

// GET /api/parametros?q=&scope=&activo=
r.get("/", async (req, res) => {
  try {
    const q = norm(req.query.q);
    const scope = norm(req.query.scope).toUpperCase();
    const activo = req.query.activo; // "1" | "0" | undefined

    const where = [];
    const args = [];

    if (q) {
      where.push("(p.clave LIKE ? OR p.descripcion LIKE ?)");
      args.push(`%${q}%`, `%${q}%`);
    }

    if (scope) {
      if (!okScopes.has(scope)) return res.status(400).json({ message: "Scope inválido" });
      where.push("p.scope = ?");
      args.push(scope);
    }

    if (activo === "1" || activo === "0") {
      where.push("p.activo = ?");
      args.push(Number(activo));
    }

    const sql =
      `SELECT p.id, p.clave, p.descripcion, p.tipo, p.valor, p.scope, p.scope_ref_id, p.activo,
              p.created_at, p.updated_at
       FROM parametros p
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY p.scope, p.clave`;

    const [rows] = await pool.query(sql, args);
    return res.json(rows);
  } catch (e) {
    console.error("[GET /parametros]", e);
    return res.status(500).json({ message: "Error obteniendo parámetros" });
  }
});

// POST /api/parametros
r.post("/", async (req, res) => {
  const body = req.body || {};
  const clave = norm(body.clave);
  const descripcion = norm(body.descripcion);
  const tipo = norm(body.tipo).toLowerCase() || "string";
  const valor = body.valor ?? "";
  const scope = norm(body.scope).toUpperCase() || "GLOBAL";
  const scope_ref_id = scope === "GLOBAL" ? null : asIntOrNull(body.scope_ref_id);
  const activo = body.activo === 0 || body.activo === "0" ? 0 : 1;

  if (!clave) return res.status(400).json({ message: "Clave requerida" });
  if (!okScopes.has(scope)) return res.status(400).json({ message: "Scope inválido" });
  if (scope !== "GLOBAL" && (scope_ref_id === null || Number.isNaN(scope_ref_id))) {
    return res.status(400).json({ message: "scope_ref_id requerido cuando scope != GLOBAL" });
  }

  const err = validateTipoValor(tipo, valor);
  if (err) return res.status(400).json({ message: err });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [ins] = await conn.query(
      `INSERT INTO parametros (clave, descripcion, tipo, valor, scope, scope_ref_id, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clave, descripcion || null, tipo, String(valor ?? ""), scope, scope_ref_id, activo]
    );

    const newId = ins.insertId;

    // actor_user_id opcional (si luego lo quieres: req.user?.id)
    await auditInsert(conn, {
      parametro_id: newId,
      accion: "CREATE",
      before_json: null,
      after_json: JSON.stringify({ clave, descripcion, tipo, valor, scope, scope_ref_id, activo }),
      actor_user_id: null,
    });

    await conn.commit();

    const [rows] = await conn.query(
      `SELECT id, clave, descripcion, tipo, valor, scope, scope_ref_id, activo, created_at, updated_at
       FROM parametros WHERE id = ?`,
      [newId]
    );

    return res.status(201).json(rows[0]);
  } catch (e) {
    await conn.rollback();
    console.error("[POST /parametros]", e);
    // error duplicado
    if (String(e?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ya existe un parámetro con esa clave/scope/scope_ref_id" });
    }
    return res.status(500).json({ message: "Error creando parámetro" });
  } finally {
    conn.release();
  }
});

// PUT /api/parametros/:id
r.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido" });

  const body = req.body || {};
  const clave = norm(body.clave);
  const descripcion = norm(body.descripcion);
  const tipo = norm(body.tipo).toLowerCase() || "string";
  const valor = body.valor ?? "";
  const scope = norm(body.scope).toUpperCase() || "GLOBAL";
  const scope_ref_id = scope === "GLOBAL" ? null : asIntOrNull(body.scope_ref_id);
  const activo = body.activo === 0 || body.activo === "0" ? 0 : 1;

  if (!clave) return res.status(400).json({ message: "Clave requerida" });
  if (!okScopes.has(scope)) return res.status(400).json({ message: "Scope inválido" });
  if (scope !== "GLOBAL" && (scope_ref_id === null || Number.isNaN(scope_ref_id))) {
    return res.status(400).json({ message: "scope_ref_id requerido cuando scope != GLOBAL" });
  }

  const err = validateTipoValor(tipo, valor);
  if (err) return res.status(400).json({ message: err });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [beforeRows] = await conn.query(`SELECT * FROM parametros WHERE id = ?`, [id]);
    const before = beforeRows[0];
    if (!before) {
      await conn.rollback();
      return res.status(404).json({ message: "Parámetro no encontrado" });
    }

    await conn.query(
      `UPDATE parametros
       SET clave=?, descripcion=?, tipo=?, valor=?, scope=?, scope_ref_id=?, activo=?
       WHERE id=?`,
      [clave, descripcion || null, tipo, String(valor ?? ""), scope, scope_ref_id, activo, id]
    );

    await auditInsert(conn, {
      parametro_id: id,
      accion: "UPDATE",
      before_json: JSON.stringify(before),
      after_json: JSON.stringify({ id, clave, descripcion, tipo, valor, scope, scope_ref_id, activo }),
      actor_user_id: null,
    });

    await conn.commit();

    const [rows] = await pool.query(
      `SELECT id, clave, descripcion, tipo, valor, scope, scope_ref_id, activo, created_at, updated_at
       FROM parametros WHERE id = ?`,
      [id]
    );
    return res.json(rows[0]);
  } catch (e) {
    await conn.rollback();
    console.error("[PUT /parametros/:id]", e);
    if (String(e?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ya existe un parámetro con esa clave/scope/scope_ref_id" });
    }
    return res.status(500).json({ message: "Error actualizando parámetro" });
  } finally {
    conn.release();
  }
});

// PATCH /api/parametros/:id/activo
r.patch("/:id/activo", async (req, res) => {
  const id = Number(req.params.id);
  const activo = req.body?.activo;
  const a = activo === 0 || activo === "0" ? 0 : 1;

  if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [beforeRows] = await conn.query(`SELECT * FROM parametros WHERE id=?`, [id]);
    const before = beforeRows[0];
    if (!before) {
      await conn.rollback();
      return res.status(404).json({ message: "Parámetro no encontrado" });
    }

    await conn.query(`UPDATE parametros SET activo=? WHERE id=?`, [a, id]);

    await auditInsert(conn, {
      parametro_id: id,
      accion: a ? "ACTIVATE" : "DEACTIVATE",
      before_json: JSON.stringify(before),
      after_json: JSON.stringify({ ...before, activo: a }),
      actor_user_id: null,
    });

    await conn.commit();

    const [rows] = await pool.query(
      `SELECT id, clave, descripcion, tipo, valor, scope, scope_ref_id, activo, created_at, updated_at
       FROM parametros WHERE id = ?`,
      [id]
    );
    return res.json(rows[0]);
  } catch (e) {
    await conn.rollback();
    console.error("[PATCH /parametros/:id/activo]", e);
    return res.status(500).json({ message: "Error actualizando activo" });
  } finally {
    conn.release();
  }
});

// DELETE /api/parametros/:id
r.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [beforeRows] = await conn.query(`SELECT * FROM parametros WHERE id=?`, [id]);
    const before = beforeRows[0];
    if (!before) {
      await conn.rollback();
      return res.status(404).json({ message: "Parámetro no encontrado" });
    }

    await conn.query(`DELETE FROM parametros WHERE id=?`, [id]);

    await auditInsert(conn, {
      parametro_id: id,
      accion: "DELETE",
      before_json: JSON.stringify(before),
      after_json: null,
      actor_user_id: null,
    });

    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error("[DELETE /parametros/:id]", e);
    return res.status(500).json({ message: "Error eliminando parámetro" });
  } finally {
    conn.release();
  }
});

export default r;
