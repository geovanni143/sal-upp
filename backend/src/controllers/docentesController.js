import { pool } from "../db.js";
import { esEmailUPP } from "../utils/validaciones.js";
import { logBitacora } from "../utils/bitacora.js";

export async function upsertDocente(req,res){
  const { id, nombre, email, activo } = req.body;
  if(!nombre || !email) return res.status(400).json({ok:false,msg:"Nombre y email requeridos"});
  if(!esEmailUPP(email)) return res.status(400).json({ok:false,msg:"Email debe ser institucional @upp.edu.mx"});

  if(id){
    // actualizar
    const [x] = await pool.query("SELECT id FROM docentes WHERE email=? AND id<>?", [email, id]);
    if(x.length) return res.status(409).json({ok:false,msg:"Email ya registrado"});
    await pool.query("UPDATE docentes SET nombre=?, email=?, activo=? WHERE id=?", [nombre,email,activo?1:0,id]);
    await logBitacora({usuario:req.user?.uid||"sys",accion:"UPDATE",entidad:"docentes",entidad_id:id});
    return res.json({ok:true,id});
  }else{
    // crear
    const [x] = await pool.query("SELECT id FROM docentes WHERE email=?", [email]);
    if(x.length) return res.status(409).json({ok:false,msg:"Email ya registrado"});
    const [r] = await pool.query("INSERT INTO docentes (nombre,email) VALUES (?,?)", [nombre,email]);
    await logBitacora({usuario:req.user?.uid||"sys",accion:"CREATE",entidad:"docentes",entidad_id:r.insertId});
    return res.json({ok:true,id:r.insertId});
  }
}
