import { useEffect, useState } from "react";
import api from "../services/api";

export default function DocentesPage(){
  const [list,setList]=useState([]);
  const [f,setF]=useState({nombre:"",email:""});

  async function load(){ const {data}=await api.get("/docentes"); setList(data); }
  useEffect(()=>{ load(); },[]);

  async function save(e){
    e.preventDefault();
    try{ await api.post("/docentes", f); setF({nombre:"",email:""}); load(); }
    catch(ex){ alert(ex?.response?.data?.msg || "Error"); }
  }

  return (
    <div className="p">
      <h2>Docentes</h2>
      <form onSubmit={save} className="card">
        <input placeholder="Nombre" value={f.nombre} onChange={e=>setF(s=>({...s,nombre:e.target.value}))} required/>
        <input placeholder="email@upp.edu.mx" value={f.email} onChange={e=>setF(s=>({...s,email:e.target.value}))} required/>
        <button>Guardar</button>
      </form>
      <ul className="list">
        {list.map(d=><li key={d.id}>{d.nombre} — {d.email}</li>)}
      </ul>
    </div>
  );
}
