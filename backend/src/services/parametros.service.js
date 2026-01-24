import { pool } from "./db.js";

/* =========================
   Helpers
   ========================= */

function castValue(tipo, raw) {
  const s = raw == null ? "" : String(raw);

  switch (tipo) {
    case "bool": {
      const v = s.trim().toLowerCase();
      return v === "true" || v === "1" || v === "yes" || v === "si";
    }
    case "int":
      return Number.parseInt(s, 10) || 0;
    case "float":
      return Number.parseFloat(s) || 0;
    case "json":
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    default:
      return s;
  }
}

function stringifyValue(tipo, val) {
  if (tipo === "json") return JSON.stringify(val ?? null);
  if (tipo === "bool") return val ? "true" : "false";
  return String(val ?? "");
}

/**
 * Resolver parámetro con jerarquía:
 * 1) GLOBAL
 * 2) ROL (si se pasa roleId)
 * 3) LAB (si se pasa labId)
 * 4) PERIODO (si se pasa periodoId)
 *
 * Puedes ajustar prioridad si quieres (por ejemplo PERIODO > LAB > ROL > GLOBAL)
 */
export async function resolveParametro(clave, { roleId, labId, periodoId } = {}) {
  const scopes = [
    { scope: "PERIODO", ref: periodoId },
    { scope: "LAB", ref: labId },
    { scope: "ROL", ref: roleId },
    { scope: "GLOBAL", ref: null },
  ];

  for (const s of scopes) {
    if (s.scope !== "GLOBAL" && (s.ref === null || s.ref === undefined)) continue;

    const [rows] = await pool.query(
      `SELECT id, clave, tipo, valor, scope, scope_ref_id
       FROM parametros
       WHERE clave=? AND scope=? AND (scope_ref_id <=> ?) AND activo=1
       LIMIT 1`,
      [clave, s.scope, s.ref ?? null]
    );

    if (rows.length) {
      const p = rows[0];
      return {
        ...p,
        valor_cast: castValue(p.tipo, p.valor),
      };
    }
  }

  return null;
}

export async function listParametros({ q, scope, scope_ref_id, activo } = {}) {
  const wh = [];
  const params = [];

  if (q) {
    wh.push("(clave LIKE ? OR descripcion LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (scope) {
    wh.push("scope=?");
    params.push(scope);
  }
  if (scope_ref_id !== undefined && scope_ref_id !== null && scope_ref_id !== "") {
    wh.push("scope_ref_id=?");
    params.push(Number(scope_ref_id));
  }
  if (activo !== undefined && activo !== null && activo !== "") {
    wh.push("activo=?");
    params.push(Number(activo) ? 1 : 0);
  }

  const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT id, clave, descripcion, tipo, valor, scope, scope_ref_id, activo, created_at, updated_at
     FROM parametros
     ${where}
     ORDER BY scope ASC, clave ASC`,
    params
  );

  return rows.map((r) => ({ ...r, valor_cast: castValue(r.tipo, r.valor) }));
}

export async function getParametroById(id) {
  const [rows] = await pool.query(
    `SELECT id, clave, descripcion, tipo, valor, scope, scope_ref_id, activo, created_at, updated_at
     FROM parametros WHERE id=? LIMIT 1`,
    [Number(id)]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { ...r, valor_cast: castValue(r.tipo, r.valor) };
}

export async function upsertParametro({
  clave,
  descripcion,
  tipo,
  valor,
  scope = "GLOBAL",
  scope_ref_id = null,
  activo = 1,
  audit = {},
}) {
  // Buscar existente
  const [exist] = await pool.query(
    `SELECT id, valor FROM parametros WHERE clave=? AND scope=? AND (scope_ref_id <=> ?) LIMIT 1`,
    [clave, scope, scope_ref_id]
  );

  const valorStr = stringifyValue(tipo, valor);

  let parametroId;
  let oldValor = null;

  if (exist.length) {
    parametroId = exist[0].id;
    oldValor = exist[0].valor;

    await pool.query(
      `UPDATE parametros
       SET descripcion=?, tipo=?, valor=?, activo=?
       WHERE id=?`,
      [descripcion ?? null, tipo, valorStr, activo ? 1 : 0, parametroId]
    );
  } else {
    const [ins] = await pool.query(
      `INSERT INTO parametros (clave, descripcion, tipo, valor, scope, scope_ref_id, activo)
       VALUES (?,?,?,?,?,?,?)`,
      [clave, descripcion ?? null, tipo, valorStr, scope, scope_ref_id, activo ? 1 : 0]
    );
    parametroId = ins.insertId;
  }

  // Audit
  await pool.query(
    `INSERT INTO parametros_audit
     (parametro_id, clave, scope, scope_ref_id, old_valor, new_valor, user_id, user_email, ip)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      parametroId,
      clave,
      scope,
      scope_ref_id,
      oldValor,
      valorStr,
      audit.user_id ?? null,
      audit.user_email ?? null,
      audit.ip ?? null,
    ]
  );

  return getParametroById(parametroId);
}

export async function deleteParametro(id) {
  await pool.query(`DELETE FROM parametros WHERE id=?`, [Number(id)]);
  return true;
}

export async function listAudit({ clave, parametro_id, limit = 200 } = {}) {
  const wh = [];
  const params = [];
  if (clave) {
    wh.push("clave=?");
    params.push(clave);
  }
  if (parametro_id) {
    wh.push("parametro_id=?");
    params.push(Number(parametro_id));
  }
  const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT id, parametro_id, clave, scope, scope_ref_id, old_valor, new_valor, user_id, user_email, ip, created_at
     FROM parametros_audit
     ${where}
     ORDER BY created_at DESC
     LIMIT ?`,
    [...params, Number(limit)]
  );
  return rows;
}
