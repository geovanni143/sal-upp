import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Login(){
  const [username,setU]=useState("admin");
  const [password,setP]=useState("admin123");
  const [err,setErr]=useState("");
  const nav = useNavigate();

  async function submit(e){
    e.preventDefault(); setErr("");
    try{
      const {data}=await api.post("/auth/login",{username,password});
      localStorage.setItem("token", data.token);
      nav("/");
    }catch(ex){ setErr(ex?.response?.data?.error || "Error"); }
  }

  return (
    <form onSubmit={submit} style={{display:"grid", gap:8, maxWidth:320}}>
      <h2>Iniciar sesion</h2>
      <input placeholder="Usuario" value={username} onChange={e=>setU(e.target.value)}/>
      <input placeholder="Contrasesa" type="password" value={password} onChange={e=>setP(e.target.value)}/>
      <button>Entrar</button>
      {err && <small style={{color:"crimson"}}>{err}</small>}
    </form>
  );
}

