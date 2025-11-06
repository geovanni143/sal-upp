import db from "../db/mysql.js";
import { esEmailUPP } from "../utils/validaciones.js";

export async function listUsers(req,res){
  const { q="", rol } = req.query;
  let sql = "SELECT id,nombre,email,rol,activo FROM users WHERE 1=1";
  const p = [];
  if(rol){ sql += " AND rol=?"; p.push(rol); }
  if(q){ sql += " AND (nombre LIKE ? OR email LIKE ?)"; p.push(`%${q}%`,`%${q}%`); }
  sql += " ORDER BY nombre ASC";
  const [rows] = await db.query(sql,p);
  res.json(rows);
}

export async function createUser(req,res){
  const { nombre, email, rol='docente', activo=1, password } = req.body;
  if(!nombre || !email) return res.status(400).json({error:"Nombre y email son obligatorios"});
  if(!esEmailUPP(email)) return res.status(422).json({error:"Debe ser correo institucional @upp.edu.mx"});
  const [dup] = await db.query("SELECT id FROM users WHERE email=?", [email]);
  if(dup.length) return res.status(409).json({error:"El email ya existe"});
  const pass = password?.trim() || "upp123";
  await db.query("INSERT INTO users (nombre,email,rol,pass_hash,activo) VALUES (?,?,?,?,?)",
    [nombre.trim(), email.trim(), rol, db.sha2(pass), Number(activo)?1:0]); // usa helper sha2 del pool
  res.status(201).json({ok:true});
}

export async function updateUser(req,res){
  const { id } = req.params;
  const { nombre, email, rol, activo=1 } = req.body;
  if(!nombre || !email) return res.status(400).json({error:"Datos incompletos"});
  if(!esEmailUPP(email)) return res.status(422).json({error:"Debe ser correo institucional"});
  const [dup] = await db.query("SELECT id FROM users WHERE email=? AND id<>?", [email, id]);
  if(dup.length) return res.status(409).json({error:"El email ya existe"});
  await db.query("UPDATE users SET nombre=?, email=?, rol=?, activo=? WHERE id=?",
    [nombre.trim(), email.trim(), rol, Number(activo)?1:0, id]);
  res.json({ok:true});
}

export async function deleteUser(req,res){
  const { id } = req.params;
  const [[rel]] = await db.query(
    `SELECT 
      (SELECT COUNT(*) FROM horarios WHERE docente_id=?) AS ch,
      (SELECT COUNT(*) FROM asistencias WHERE docente_id=?) AS ca`,
      [id,id]
  );
  if((rel.ch||0) > 0 || (rel.ca||0) > 0)
    return res.status(409).json({error:"No se puede eliminar: tiene registros vinculados"});
  await db.query("DELETE FROM users WHERE id=?", [id]);
  res.json({ok:true});
}
