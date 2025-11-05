import { useEffect, useState } from 'react';
import CardItem from '../components/CardItem';

const empty = { id:null, clave:'', nombre:'', edificio:'', nivel:'', activo:1 };

export default function LabsPage(){
  const [rows,setRows]=useState([]);
  const [f,setF]=useState(empty);
  const [open,setOpen]=useState(false);
  const [msg,setMsg]=useState('');

  const load=()=>api('/labs').then(setRows);
  useEffect(()=>{load()},[]);

  const save=async(e)=>{e.preventDefault(); setMsg('');
    try{
      if(f.id) await api(`/labs/${f.id}`,{method:'PUT', body:JSON.stringify(f)});
      else     await api('/labs',{method:'POST', body:JSON.stringify(f)});
      setOpen(false); setF(empty); load();
    }catch(err){ setMsg(err.message); }
  };
  const del=async(id)=>{
    try{ await api(`/labs/${id}`,{method:'DELETE'}); load(); }
    catch(e){ alert(e.message); }
  };

  return (
    <div className="page">
      <h2>Catálogo - Laboratorios</h2>

      <div className="col gap">
        {rows.map(x=>(
          <CardItem
            key={x.id}
            title={`${x.clave} ${x.nombre}`}
            subtitle={`${x.edificio || ''} ${x.nivel || ''}`.trim()}
            onEdit={()=>{ setF(x); setOpen(true); }}
            onDelete={()=>del(x.id)}
            onMenu={()=>{}}
          />
        ))}
      </div>

      <div className="mt">
        <button className="btn-primary" onClick={()=>{setF(empty); setOpen(true);}}>
          + Agregar Laboratorio
        </button>
      </div>

      {open && (
        <div className="form-card mt">
          <h3>{f.id?'Editar':'Crear'} Laboratorio</h3>
          {msg && <p style={{color:'crimson'}}>{msg}</p>}
          <form onSubmit={save}>
            <div className="form-row"><label>Clave:</label>
              <input value={f.clave} onChange={e=>setF({...f,clave:e.target.value})} required />
            </div>
            <div className="form-row"><label>Nombre:</label>
              <input value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})} required />
            </div>
            <div className="form-row"><label>Edificio:</label>
              <input value={f.edificio} onChange={e=>setF({...f,edificio:e.target.value})} />
            </div>
            <div className="form-row"><label>Nivel:</label>
              <input value={f.nivel} onChange={e=>setF({...f,nivel:e.target.value})} />
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
