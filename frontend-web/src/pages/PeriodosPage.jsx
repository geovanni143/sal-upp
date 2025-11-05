import { useEffect, useState } from 'react';
import { api } from '../api/http';
import CardItem from '../components/CardItem';

const empty = { id:null, nombre:'', fecha_ini:'', fecha_fin:'', activo:1 };

export default function PeriodosPage(){
  const [rows,setRows]=useState([]);
  const [f,setF]=useState(empty);
  const [open,setOpen]=useState(false);
  const [msg,setMsg]=useState('');

  const load=()=>api('/periodos').then(setRows);
  useEffect(()=>{load()},[]);

  const save=async(e)=>{e.preventDefault(); setMsg('');
    try{
      if(f.id) await api(`/periodos/${f.id}`,{method:'PUT', body:JSON.stringify(f)});
      else     await api('/periodos',{method:'POST', body:JSON.stringify(f)});
      setOpen(false); setF(empty); load();
    }catch(err){ setMsg(err.message); }
  };
  const del=async(id)=>{ try{ await api(`/periodos/${id}`,{method:'DELETE'}); load(); }catch(e){ alert(e.message); } };

  return (
    <div className="page">
      <h2>Catálogo - Periodos</h2>

      <div className="col gap">
        {rows.map(x=>(
          <CardItem
            key={x.id}
            title={x.nombre}
            subtitle={`Del ${x.fecha_ini} al ${x.fecha_fin}`}
            onEdit={()=>{ setF(x); setOpen(true); }}
            onDelete={()=>del(x.id)}
          />
        ))}
      </div>

      <div className="mt">
        <button className="btn-primary" onClick={()=>{setF(empty); setOpen(true);}}>+ Agregar Periodo</button>
      </div>

      {open && (
        <div className="form-card mt">
          <h3>{f.id?'Editar':'Crear'} Periodo</h3>
          {msg && <p style={{color:'crimson'}}>{msg}</p>}
          <form onSubmit={save}>
            <div className="form-row"><label>Nombre:</label>
              <input value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})} required/>
            </div>
            <div className="form-row"><label>Fecha Inicio:</label>
              <input type="date" value={f.fecha_ini} onChange={e=>setF({...f,fecha_ini:e.target.value})} required/>
            </div>
            <div className="form-row"><label>Fecha Fin:</label>
              <input type="date" value={f.fecha_fin} onChange={e=>setF({...f,fecha_fin:e.target.value})} required/>
            </div>
            <div className="form-row"><label>Activo:</label>
              <select value={f.activo} onChange={e=>setF({...f,activo:Number(e.target.value)})}>
                <option value={1}>Sí</option><option value={0}>No</option>
              </select>
            </div>
            <div className="action-row">
              <button type="button" className="btn-primary" onClick={()=>setOpen(false)}>Cancelar</button>
              <button className="btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
