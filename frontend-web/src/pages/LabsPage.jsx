// src/pages/LabsPage.jsx
import { useEffect, useState } from "react";
import api from "../services/api";
import "./menu.css"; // para reutilizar estilos base

const empty = { clave:"", nombre:"", ubicacion:"", activo:true };

export default function LabsPage(){
  const [list,setList] = useState([]);
  const [f,setF] = useState(empty);
  const [editId,setEditId] = useState(null);
  const [msg,setMsg] = useState("");

  async function load(){
    const {data} = await api.get("/labs");
    setList(data);
  }
  useEffect(()=>{ load(); },[]);

  async function save(e){
    e.preventDefault(); setMsg("");
    try{
      if(editId){
        await api.put(`/labs/${editId}`, f);
      }else{
        await api.post("/labs", f);
      }
      setF(empty); setEditId(null); await load();
    }catch(ex){
      setMsg(ex?.response?.data?.msg || "Error");
    }
  }

  function startEdit(x){
    setEditId(x.id);
    setF({ clave:x.clave, nombre:x.nombre, ubicacion:x.ubicacion||"", activo: !!x.activo });
  }

  async function remove(id){
    if(!confirm("¿Eliminar laboratorio?")) return;
    try{
      await api.delete(`/labs/${id}`);
      await load();
    }catch(ex){
      alert(ex?.response?.data?.msg || "No se pudo eliminar");
    }
  }

  return (
    <div className="page-shell">
      <div className="menu-card">
        <div className="menu-head">
          <div className="menu-title">Laboratorios</div>
        </div>

        <form onSubmit={save} className="block" style={{marginBottom:14}}>
          <div style={{display:"grid", gap:10, gridTemplateColumns:"1fr 1fr"}}>
            <input placeholder="Clave (única)" value={f.clave} onChange={e=>setF(s=>({...s,clave:e.target.value}))} required disabled={!!editId}/>
            <input placeholder="Nombre" value={f.nombre} onChange={e=>setF(s=>({...s,nombre:e.target.value}))} required/>
            <input placeholder="Ubicación (opcional)" value={f.ubicacion} onChange={e=>setF(s=>({...s,ubicacion:e.target.value}))}/>
            <label className="chk" style={{display:"flex", alignItems:"center", gap:8}}>
              <input type="checkbox" checked={f.activo} onChange={e=>setF(s=>({...s,activo:e.target.checked}))}/> Activo
            </label>
          </div>
          <div style={{display:"flex", gap:10, marginTop:10}}>
            <button className="btn-secondary">{editId ? "Actualizar" : "Crear"}</button>
            {editId && <button type="button" className="btn-secondary-ghost" onClick={()=>{ setEditId(null); setF(empty); }}>Cancelar</button>}
          </div>
          {msg && <small className="error-msg" style={{color:"crimson"}}>{msg}</small>}
        </form>

        <div className="block">
          <h3>Lista</h3>
          <div style={{overflowX:"auto"}}>
            <table className="tbl" style={{width:"100%", borderCollapse:"separate", borderSpacing:"0 6px"}}>
              <thead>
                <tr style={{textAlign:"left"}}>
                  <th>Clave</th><th>Nombre</th><th>Ubicación</th><th>Activo</th><th>Creado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(l=>(
                  <tr key={l.id} style={{background:"#fff", boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
                    <td>{l.clave}</td>
                    <td>{l.nombre}</td>
                    <td>{l.ubicacion || "-"}</td>
                    <td>{l.activo ? "Sí":"No"}</td>
                    <td>{new Date(l.creado_en).toLocaleString()}</td>
                    <td style={{whiteSpace:"nowrap"}}>
                      <button className="btn-pill" onClick={()=>startEdit(l)}>Editar</button>{" "}
                      <button className="btn-pill" style={{background:"#ef4444"}} onClick={()=>remove(l.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {list.length===0 && <tr><td colSpan={6}>Sin registros</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
