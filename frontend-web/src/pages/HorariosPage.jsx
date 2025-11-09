import { useEffect, useMemo, useState } from "react";
import { periodosApi, labsApi, horariosApi } from "../api/http";
import "./menu.css";
import "./horarios-scope.css";

const DIAS = [
  { id:1, label:"Lunes" }, { id:2, label:"Martes" }, { id:3, label:"Miércoles" },
  { id:4, label:"Jueves" }, { id:5, label:"Viernes" },
];

const horasMedias = (() => {
  const out = []; const pad = (n)=> String(n).padStart(2,"0");
  for (let H=7; H<20; H++){ out.push(`${pad(H)}:00`); out.push(`${pad(H)}:30`); }
  return out;
})();

export default function HorariosPage(){
  const [periodos, setPeriodos] = useState([]);
  const [labs, setLabs] = useState([]);
  const [periodoId, setPeriodoId] = useState("");
  const [labId, setLabId] = useState("");

  const [bloques, setBloques] = useState([]);           // existentes
  const [draftUpserts, setDraftUpserts] = useState([]); // nuevos/edits
  const [draftDeletes, setDraftDeletes] = useState([]); // ids a borrar
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  /* ===== Cargar catálogos ===== */
  useEffect(()=>{(async()=>{
    try{
      const [p, l] = await Promise.all([
        periodosApi.list({ includeDeleted: 0 }),
        labsApi.list({}),
      ]);
      setPeriodos(p.data || []);
      setLabs(l.data || []);
    }catch(e){
      setErr("Error al listar periodos o laboratorios");
      console.error(e);
    }
  })();},[]);

  /* ===== Cargar semana ===== */
  const cargarSemana = async()=>{
    if(!periodoId || !labId){ setBloques([]); return; }
    setLoading(true); setErr("");
    try{
      const { data } = await horariosApi.semana({ periodo_id: periodoId, lab_id: labId });
      const norm = (s)=> (s||"").slice(0,5);
      const bloquesNorm = (data?.bloques || []).map(b => ({
        ...b,
        hora_ini: norm(b.hora_ini),
        hora_fin: norm(b.hora_fin),
      }));
      setBloques(bloquesNorm);
      setDraftUpserts([]); setDraftDeletes([]);
    }catch(e){
      setErr(e?.response?.data?.error || e.message);
    }finally{
      setLoading(false);
    }
  };
  useEffect(()=>{ cargarSemana(); }, [periodoId, labId]);

  /* ===== Helpers ===== */
  const avanzar = (hhmm, addMin)=>{
    const [H,M] = hhmm.split(":").map(Number);
    const d = new Date(2000,1,1,H,M); d.setMinutes(d.getMinutes()+addMin);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };
  const bloquesVigentes = useMemo(()=>[...bloques, ...draftUpserts],[bloques, draftUpserts]);
  const cellBloques = (dia, hhmm)=>
    bloquesVigentes.filter(b => b.dia===dia && b.hora_ini<=hhmm && b.hora_fin>hhmm);

  /* ===== Crear / borrar ===== */
  const crearDesdeCelda = (dia, hora_ini)=>{
    const materia = prompt("Materia:");
    if(!materia) return;
    const hora_fin = prompt("Hora fin (HH:MM):", avanzar(hora_ini, 60)) || avanzar(hora_ini, 60);
    if (hora_fin <= hora_ini) return alert("Hora fin debe ser mayor a hora inicio.");
    const choca = bloquesVigentes.some(b => b.dia===dia && (hora_ini < b.hora_fin) && (b.hora_ini < hora_fin));
    if (choca) return alert("Traslape con otro bloque.");
    const docente_id_str = prompt("ID de docente (opcional):",""); // TODO: dropdown
    const docente_id = docente_id_str ? Number(docente_id_str) : null;
    const grupo = prompt("Grupo (opcional):") || null;

    setDraftUpserts(prev => [...prev, { dia, hora_ini, hora_fin, materia, docente_id, grupo, activo:1 }]);
  };
  const borrarBloque = (b)=>{
    if(!confirm("¿Eliminar este bloque?")) return;
    if (!b.id) setDraftUpserts(prev => prev.filter(x => x !== b));
    else setDraftDeletes(prev => [...prev, b.id]);
  };

  /* ===== Guardar & PDF ===== */
  const guardar = async()=>{
    if(!periodoId || !labId) return alert("Selecciona periodo y laboratorio");
    try{
      await horariosApi.bulk({
        periodo_id: Number(periodoId),
        lab_id: Number(labId),
        upserts: draftUpserts,
        deletes: draftDeletes
      });
      await cargarSemana();
      alert("Horario guardado");
    }catch(e){
      alert(e?.response?.data?.reason || e?.response?.data?.error || e.message);
    }
  };
  const pdf = async()=>{
    if(!periodoId || !labId) return;
    try{
      const res = await horariosApi.pdf({ periodo_id: periodoId, lab_id: labId });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "horario.pdf"; a.click();
      URL.revokeObjectURL(url);
    }catch(e){ alert(e?.response?.data?.error || e.message); }
  };

  return (
    <div className="page-shell hs-page">
      <div className="menu-card hs__card">
        <div className="hs__head">
          <div className="hs__brand">Catálogo — Horarios</div>
          <div className="hs__sub">Crea el horario semanal completo por laboratorio</div>
        </div>

        {/* filtros */}
        <div className="hs__filters">
          <select className="input" value={periodoId} onChange={e=>setPeriodoId(e.target.value)}>
            <option value="">Periodo…</option>
            {periodos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>

          <select className="input" value={labId} onChange={e=>setLabId(e.target.value)}>
            <option value="">Laboratorio…</option>
            {labs.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>

          <div className="hs__actions">
            <button className="btn ghost" onClick={cargarSemana} disabled={loading}>Recargar</button>
            <button className="btn" onClick={guardar}>Guardar semana</button>
            <button className="btn ghost" onClick={pdf}>PDF</button>
          </div>
        </div>

        {err && <p className="error-inline" style={{marginTop:4}}>{err}</p>}
        {!periodoId || !labId ? (
          <p className="hs__muted">Selecciona un periodo y un laboratorio para comenzar.</p>
        ) : null}

        {/* ÚNICA VISTA: Tabla siempre (scroll en pantallas chicas) */}
        <div className="hs__wrap">
          <table className="hs__grid">
            <thead>
              <tr>
                <th style={{width:96}}>Hora</th>
                {DIAS.map(d => <th key={d.id}>{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {horasMedias.map(hhmm => (
                <tr key={hhmm}>
                  <td className="hs__time">{hhmm}</td>
                  {DIAS.map(d => {
                    const b = cellBloques(d.id, hhmm)[0] || null;
                    return (
                      <td key={d.id} className="hs__cell"
                          onDoubleClick={()=>crearDesdeCelda(d.id, hhmm)}
                          title="Doble clic para crear bloque">
                        {b && (
                          <div className="hs__block" onClick={(e)=>e.stopPropagation()}>
                            <div className="hs__btitle">{b.materia}{b.grupo?` (${b.grupo})`:""}</div>
                            <div className="hs__bmeta">{b.hora_ini}–{b.hora_fin}</div>
                            <div className="hs__bmeta">Doc: {b.docente_nombre || b.docente_id || "-"}</div>
                            <button className="hs__mini danger" onClick={()=>borrarBloque(b)}>×</button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {periodoId && labId && bloquesVigentes.length===0 && (
            <p className="hs__muted">No hay bloques aún. Doble clic en una celda para agregar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
