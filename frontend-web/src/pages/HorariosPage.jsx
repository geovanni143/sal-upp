import { useEffect, useState } from "react";
import api from "../services/api";

export default function HorariosPage(){
  const [periodo,setPeriodo]=useState({nombre:"",fecha_inicio:"",fecha_fin:""});
  const [labs,setLabs]=useState([]); const [docs,setDocs]=useState([]);
  const [hor,setHor]=useState({periodo_id:"",docente_id:"",laboratorio_id:"",dia:"L",hora_ini:"07:00",hora_fin:"09:00",materia:""});

  useEffect(()=>{ (async()=>{
    const [L,D]=await Promise.all([api.get("/labs"), api.get("/docentes")]).catch(()=>[{data:[]},{data:[]}]);
    setLabs(L?.data||[]); setDocs(D?.data||[]);
  })() },[]);

  async function crearPeriodo(e){
    e.preventDefault();
    const {data}=await api.post("/periodos", periodo);
    setHor(h=>({...h,periodo_id:String(data.id)}));
    alert("Periodo creado: "+data.id);
  }

  async function crearHorario(e){
    e.preventDefault();
    try{ await api.post("/periodos/horarios", hor); alert("Horario creado"); }
    catch(ex){ alert(ex?.response?.data?.msg || "Error al crear horario"); }
  }

  return (
    <div className="p">
      <h2>Periodos y Horarios</h2>

      <form onSubmit={crearPeriodo} className="card">
        <h3>Nuevo periodo</h3>
        <input placeholder="Nombre" value={periodo.nombre} onChange={e=>setPeriodo(p=>({...p,nombre:e.target.value}))} required/>
        <div className="row">
          <input type="date" value={periodo.fecha_inicio} onChange={e=>setPeriodo(p=>({...p,fecha_inicio:e.target.value}))} required/>
          <input type="date" value={periodo.fecha_fin} onChange={e=>setPeriodo(p=>({...p,fecha_fin:e.target.value}))} required/>
        </div>
        <button>Guardar periodo</button>
      </form>

      <form onSubmit={crearHorario} className="card">
        <h3>Nuevo horario</h3>
        <input placeholder="Periodo ID" value={hor.periodo_id} onChange={e=>setHor(h=>({...h,periodo_id:e.target.value}))} required/>
        <select value={hor.docente_id} onChange={e=>setHor(h=>({...h,docente_id:e.target.value}))} required>
          <option value="">Docente</option>
          {docs.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <select value={hor.laboratorio_id} onChange={e=>setHor(h=>({...h,laboratorio_id:e.target.value}))} required>
          <option value="">Laboratorio</option>
          {labs.map(l=><option key={l.id} value={l.id}>{l.clave} - {l.nombre}</option>)}
        </select>
        <div className="row">
          <select value={hor.dia} onChange={e=>setHor(h=>({...h,dia:e.target.value}))}>
            {['L','M','X','J','V','S'].map(d=><option key={d} value={d}>{d}</option>)}
          </select>
          <input type="time" value={hor.hora_ini} onChange={e=>setHor(h=>({...h,hora_ini:e.target.value}))}/>
          <input type="time" value={hor.hora_fin} onChange={e=>setHor(h=>({...h,hora_fin:e.target.value}))}/>
        </div>
        <input placeholder="Materia" value={hor.materia} onChange={e=>setHor(h=>({...h,materia:e.target.value}))}/>
        <button>Guardar horario</button>
      </form>
    </div>
  );
}
