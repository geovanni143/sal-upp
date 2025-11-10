import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";   // 👈 para navegar
import { labsApi } from "../api/http";
import "./menu.css";

const EMPTY = { id:null, nombre:"", encargado:"", descripcion:"" };

export default function LabsPage(){
  const [rows,setRows]=useState([]);
  const [q,setQ]=useState("");
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const nav = useNavigate();  // 👈 hook de navegación

  const load = async()=>{
    setLoading(true); setError("");
    try{ const res = await labsApi.list({ q }); setRows(res.data); }
    catch(e){ setError(e?.response?.data?.error || e.message); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);
  const limpiar=()=> setForm(EMPTY);

  const onSubmit = async(e)=>{
    e.preventDefault(); setSaving(true);
    try{
      const {id, nombre, encargado, descripcion} = form;
      if(id) await labsApi.update(id, {nombre, encargado, descripcion});
      else   await labsApi.create({nombre, encargado, descripcion});
      limpiar(); await load();
    }catch(e){ alert(e?.response?.data?.error || e.message); }
    finally{ setSaving(false); }
  };

  const editar = (r)=>{ const {id,nombre,encargado,descripcion}=r; setForm({id,nombre,encargado,descripcion}); window.scrollTo({top:0,behavior:"smooth"}); };
  const eliminar = async(id)=>{
    if(!confirm("¿Eliminar laboratorio?")) return;
    try{ await labsApi.remove(id); await load(); }
    catch(e){ alert(e?.response?.data?.reason || e?.response?.data?.error || e.message); }
  };
  const toggleActivo = async(id)=>{
    try{
      setRows(prev => prev.map(x => x.id===id ? {...x, activo:x.activo?0:1} : x)); // optimista
      await labsApi.toggleActive(id);
    }catch(e){
      await load();
      alert(e?.response?.data?.error || e.message);
    }
  };

  const list = useMemo(()=>{
    const t=q.trim().toLowerCase();
    if(!t) return rows;
    return rows.filter(r => `${r.nombre} ${r.encargado} ${r.descripcion}`.toLowerCase().includes(t));
  },[rows,q]);

  return (
    <div className="page-shell">
      <div className="menu-card manage-narrow">
        <div className="menu-head">
          <div className="brand">Catálogo — Laboratorios</div>
          <div className="menu-sub">Crear / editar / eliminar y ver estado</div>
        </div>

        {/* 🔙 Botón de regresar */}
        <div className="manage-footer" style={{ marginBottom: "12px" }}>
          <button
            className="manage-back"
            type="button"
            onClick={() => nav(-1)}  // regresa una página atrás
          >
            ← Regresar
          </button>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input className="input" placeholder="Buscar por nombre, encargado o descripción…"
                 value={q} onChange={e=>setQ(e.target.value)} />
          <button className="btn" onClick={load} disabled={loading}>{loading?"Cargando…":"Buscar"}</button>
          <button className="btn ghost" onClick={()=>{setQ(""); load();}}>Limpiar</button>
        </div>

        {error && <p className="error-inline">{error}</p>}

        <ul className="manage-list">
          {list.map(r=>(
            <li key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#F7FAFF",borderRadius:14,padding:"10px 12px"}}>
              <div style={{display:"grid",gap:2}}>
                <div style={{fontWeight:800}}>{r.nombre}</div>
                <div style={{fontSize:13,color:"#334155"}}>Encargado: <b>{r.encargado || "—"}</b></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className={`badge ${r.activo? "green":"red"}`}>{r.activo? "Activo":"Inactivo"}</span>
                <button className="btn icon" title={r.activo? "Desactivar":"Activar"} onClick={()=>toggleActivo(r.id)}>
                  {r.activo? "⏻" : "▶"}
                </button>
                <button className="btn icon" title="Editar" onClick={()=>editar(r)}>✎</button>
                <button className="btn icon danger" title="Eliminar" onClick={()=>eliminar(r.id)}>🗑</button>
              </div>
            </li>
          ))}
          {!loading && list.length===0 && (<li className="empty">Sin resultados.</li>)}
        </ul>

        <h3 style={{margin:"12px 4px 8px"}}>{form.id? "Editar":"Crear"} laboratorio</h3>

        <form onSubmit={onSubmit} className="form-card">
          <div className="form-row"><label>Nombre:</label>
            <input value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} required/>
          </div>
          <div className="form-row"><label>Encargado:</label>
            <input value={form.encargado} onChange={e=>setForm({...form, encargado:e.target.value})}/>
          </div>
          <div className="form-row"><label>Descripción:</label>
            <textarea rows={4} value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})}/>
          </div>
          <div className="actions-grid">
            <button type="button" className="btn-secondary-ghost" onClick={limpiar}>Cancelar</button>
            <button type="submit" className="btn-wide">{saving? "Guardando…":"Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
