import { useEffect, useState } from "react";
import api from "../services/api";

export default function Dashboard(){
  const [labs,setLabs]=useState([]);
  const [err,setErr]=useState("");

  useEffect(()=>{
    (async ()=>{
      try{
        const {data}=await api.get("/labs");
        setLabs(data);
      }catch(e){ setErr("Inicia sesion o levanta la API"); }
    })();
  },[]);

  return (
    <div>
      <h2>Dashboard</h2>
      {err && <p style={{color:"crimson"}}>{err}</p>}
      <ul>
        {labs.map(l => <li key={l.id}>{l.nombre} A93{l.edificio} {l.piso}</li>)}
      </ul>
    </div>
  );
}

