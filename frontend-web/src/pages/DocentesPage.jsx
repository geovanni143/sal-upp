import { useEffect, useState } from 'react';
import { api } from '../api/http';

export default function DocentesPage(){
  const [docs,setDocs]=useState([]);
  const [f,setF]=useState({nombre:'',email:''});
  const [msg,setMsg]=useState('');
  const load=()=> api('/docentes').then(setDocs).catch(e=>setMsg(e.message));
  useEffect(()=>{load()},[]);
  const add=async(e)=>{e.preventDefault(); setMsg('');
    try{ await api('/docentes',{method:'POST', body:JSON.stringify(f)}); setF({nombre:'',email:''}); load();}
    catch(e){ setMsg(e.message); }
  };
  return (
    <div className="page">
      <h2>Docentes</h2>
      {msg && <p style={{color:'crimson'}}>{msg}</p>}
      <form onSubmit={add} className="row gap">
        <input placeholder="Nombre" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})} required/>
        <input placeholder="email@upp.edu.mx" value={f.email} onChange={e=>setF({...f,email:e.target.value})} required/>
        <button>Agregar</button>
      </form>
      <ul className="mt">
        {docs.map(d=> <li key={d.id}>{d.nombre} — {d.email}</li>)}
      </ul>
    </div>
  );
}
