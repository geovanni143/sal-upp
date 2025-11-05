import { useEffect, useState } from 'react';
import CardItem from '../components/CardItem';

const empty = { id:null, periodo_id:'', lab_id:'', docente_id:'', dia:1, hora_ini:'07:00', hora_fin:'08:00', activo:1 };
const DIAS = [{v:1,t:'Lunes'},{v:2,t:'Martes'},{v:3,t:'Miércoles'},{v:4,t:'Jueves'},{v:5,t:'Viernes'},{v:6,t:'Sábado'},{v:7,t:'Domingo'}];

export default function HorariosPage(){
  const [rows,setRows]=useState([]);
  const [periodos,setPeriodos]=useState([]);
  const [labs,setLabs]=useState([]);
  const [users,setUsers]=useState([]);
  const [f,setF]=useState(empty);
  const [open,setOpen]=useState(false);
  const [msg,setMsg]=useState('');

  const loadAll=async()=>{
    const [h, p, l, u] = await Promise.all([
      api('/horarios'), api('/periodos'), api('/labs'), api('/users')
    ]);
    setRows(h); setPeriodos(p); setLabs(l); setUsers(u.filter(x=>x.rol==='docente'));
  };
  useEffect(()=>{ loadAll() },[]);

  const save=async(e)=>{e.preventDefault(); setMsg('');
    try{
      if(f.hora_ini >= f.hora_fin) return setMsg('hora_ini debe ser menor a hora_fin');
      if(f.id) await api(`/horarios/${f.id}`,{method:'PUT', body:JSON.stringify(f)}); // (no implementamos PUT arriba, opcional)
      else     await api('/horarios',{method:'POST', body:JSON.stringify(f)});
      setOpen(false); setF(empty); loadAll();
    }catch(err){ setMsg(err.message); }
  };
  const del=async(id)=>{ await api(`/horarios/${id}`,{method:'DELETE'}); loadAll(); };

  return (
    <div className="page">
      <h2>Catálogo - Horarios</h2>

      <div className="col gap">
        {rows.map(x=>(
          <CardItem
            key={x.id}
            title={`${x.periodo} · ${x.lab}`}
            subtitle={`${x.docente}\n${DIAS.find(d=>d.v===x.dia)?.t} ${String(x.hora_ini).slice(0,5)} - ${String(x.hora_fin).slice(0,5)}`}
            onEdit={()=>{ setF({
              id:x.id,periodo_id:x.periodo_id,lab_id:x.lab_id,docente_id:x.docente_id,
              dia:x.dia,hora_ini:String(x.hora_ini).slice(0,5),hora_fin:String(x.hora_fin).slice(0,5),activo:x.activo
            }); setOpen(true); }}
            onDelete={()=>del(x.id)}
          />
        ))}
      </div>

      <div className="mt">
        <button className="btn-primary" onClick={()=>{setF(empty); setOpen(true);}}>+ Agregar Horario</button>
      </div>

      {open && (
        <div className="form-card mt">
          <h3>{f.id?'Editar':'Crear'} Horario</h3>
          {msg && <p style={{color:'crimson'}}>{msg}</p>}
          <form onSubmit={save}>
            <div className="form-row"><label>Periodo:</label>
              <select value={f.periodo_id} onChange={e=>setF({...f,periodo_id:Number(e.target.value)})} required>
                <option value="">Seleccione</option>
                {periodos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Docente:</label>
              <select value={f.docente_id} onChange={e=>setF({...f,docente_id:Number(e.target.value)})} required>
                <option value="">Seleccione</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Laboratorio:</label>
              <select value={f.lab_id} onChange={e=>setF({...f,lab_id:Number(e.target.value)})} required>
                <option value="">Seleccione</option>
                {labs.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Día:</label>
              <select value={f.dia} onChange={e=>setF({...f,dia:Number(e.target.value)})}>
                {DIAS.map(d=><option key={d.v} value={d.v}>{d.t}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Hora Inicio:</label>
              <input type="time" value={f.hora_ini} onChange={e=>setF({...f,hora_ini:e.target.value})} required/>
            </div>
            <div className="form-row"><label>Hora Fin:</label>
              <input type="time" value={f.hora_fin} onChange={e=>setF({...f,hora_fin:e.target.value})} required/>
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
