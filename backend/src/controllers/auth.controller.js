import { pool } from "../db/mysql.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function login(req,res){
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({error:"Faltan credenciales"});

  const [rows] = await pool.query(
    "SELECT id, username, password_hash, role, nombre FROM users WHERE username=? AND activo=1",
    [username]
  );
  const user = rows[0];
  if(!user) return res.status(401).json({error:"Usuario o contraseña inválidos"});

  const ok = await bcrypt.compare(password, user.password_hash);
  if(!ok) return res.status(401).json({error:"Usuario o contraseña inválidos"});

  const token = jwt.sign(
    { id:user.id, username:user.username, role:user.role, nombre:user.nombre },
    process.env.JWT_SECRET,
    { expiresIn:"8h" }
  );
  res.json({ token, user:{ id:user.id, username:user.username, role:user.role, nombre:user.nombre }});
}
