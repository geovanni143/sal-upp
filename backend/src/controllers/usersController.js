import { pool } from "../services/db.js";
import { hashPassword } from "../services/hash.js";

/** GET /api/users */
export async function listUsers(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, nombre, apellidos, email, rol, activo
       FROM users
       WHERE eliminado = 0
       ORDER BY FIELD(rol,'superadmin','admin','docente'), nombre ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error al listar usuarios" });
  }
}

/** POST /api/users
 * body: { username, nombre, apellidos?, email, rol?, activo?, password }
 * - Crea con password hasheado.
 */
export async function createUser(req, res) {
  try {
    const {
      username,
      nombre,
      apellidos = "",
      email,
      rol = "docente",
      activo = 1,
      password,
    } = req.body;

    if (!username || !email || !nombre || !password) {
      return res.status(400).json({
        message: "Faltan campos obligatorios (username, email, nombre, password)",
      });
    }

    // Evitar creación de superadmin salvo que quien crea sea superadmin (si usas auth)
    if (rol === "superadmin" && req.user?.rol !== "superadmin") {
      return res.status(403).json({ message: "No autorizado para crear superadmin" });
    }

    // Duplicados
    const [dups] = await pool.query(
      "SELECT id FROM users WHERE (username=? OR email=?) AND eliminado=0 LIMIT 1",
      [username, email]
    );
    if (dups.length) {
      return res.status(409).json({ message: "Username o email ya existen" });
    }

    const passHash = await hashPassword(password);

    const [result] = await pool.query(
      `INSERT INTO users (username, nombre, apellidos, email, rol, activo, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, nombre, apellidos, email, rol, Number(activo) ? 1 : 0, passHash]
    );

    const [nuevo] = await pool.query(
      `SELECT id, username, nombre, apellidos, email, rol, activo
       FROM users WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(nuevo[0]);
  } catch (e) {
    console.error(e);
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Username o email ya existen" });
    }
    res.status(500).json({ message: "Error al crear usuario" });
  }
}

/** PUT /api/users/:id
 * body: { username?, nombre?, apellidos?, email?, rol?, activo? }
 * - NO cambia contraseña aquí.
 * - NO permite editar superadmin salvo por superadmin.
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { username, nombre, apellidos, email, rol, activo } = req.body;

    // Protección superadmin
    const [rows] = await pool.query(
      `SELECT rol FROM users WHERE id=? AND eliminado=0`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Usuario no encontrado" });
    if (rows[0].rol === "superadmin" && req.user?.rol !== "superadmin") {
      return res.status(403).json({ message: "No puedes editar al superadmin" });
    }

    // Evitar duplicados (email/username de otros)
    if (email || username) {
      const [dup] = await pool.query(
        `SELECT id FROM users
         WHERE eliminado=0 AND id<>? AND (email=? OR username=?) LIMIT 1`,
        [id, email ?? "", username ?? ""]
      );
      if (dup.length) {
        return res.status(409).json({ message: "Username o email ya existen" });
      }
    }

    const fields = [];
    const params = [];
    if (username != null)   { fields.push("username=?");   params.push(username); }
    if (nombre != null)     { fields.push("nombre=?");     params.push(nombre); }
    if (apellidos != null)  { fields.push("apellidos=?");  params.push(apellidos); }
    if (email != null)      { fields.push("email=?");      params.push(email); }
    if (rol != null)        { fields.push("rol=?");        params.push(rol); }
    if (activo != null)     { fields.push("activo=?");     params.push(Number(activo) ? 1 : 0); }

    if (!fields.length) return res.json({ message: "Nada que actualizar" });

    params.push(id);

    await pool.query(
      `UPDATE users SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id=? AND eliminado=0`,
      params
    );

    const [user] = await pool.query(
      `SELECT id, username, nombre, apellidos, email, rol, activo
       FROM users WHERE id=?`,
      [id]
    );
    res.json(user[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error al actualizar usuario" });
  }
}

/** PATCH /api/users/:id/activo
 * body: { activo }
 */
export async function toggleActive(req, res) {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const [rows] = await pool.query(
      `SELECT rol FROM users WHERE id=? AND eliminado=0`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Usuario no encontrado" });
    if (rows[0].rol === "superadmin") {
      return res.status(403).json({ message: "No puedes desactivar al superadmin" });
    }

    await pool.query(
      `UPDATE users SET activo=?, updated_at=NOW() WHERE id=?`,
      [Number(activo) ? 1 : 0, id]
    );
    res.json({ id, activo: Number(activo) ? 1 : 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error al cambiar activo" });
  }
}

/** DELETE /api/users/:id (soft delete) */
export async function removeUser(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT rol FROM users WHERE id=? AND eliminado=0`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Usuario no encontrado" });
    if (rows[0].rol === "superadmin") {
      return res.status(403).json({ message: "No puedes eliminar al superadmin" });
    }

    await pool.query(
      `UPDATE users
       SET eliminado=1, eliminado_en=NOW(), activo=0, updated_at=NOW()
       WHERE id=?`,
      [id]
    );
    res.json({ id, eliminado: 1 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error al eliminar usuario" });
  }
}
