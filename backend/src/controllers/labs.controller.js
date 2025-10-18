import { pool } from "../db/mysql.js";
export async function listLabs(_req,res){
  const [rows] = await pool.query("SELECT id,nombre,edificio,piso FROM laboratorios ORDER BY nombre");
  res.json(rows);
}
