import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { compressImage } from "../utils/compressImage";
import SignaturePad from "signature_pad";

export default function AsistenciaDocente(){
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const sigRef = useRef(null);
  const [sigPad,setSigPad]=useState(null);
  const [fotoFile,setFotoFile]=useState(null);
  const [docente_id,setDocenteId]=useState("");    // en real, tomar de token
  const [laboratorio_id,setLabId]=useState("");
  const [origen,setOrigen]=useState("codigo");      // 'qr' o 'codigo'
  const [msg,setMsg]=useState("");

  useEffect(()=>{
    // Cámara en vivo
    (async ()=>{
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio:false });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const pad = new SignaturePad(sigRef.current, { minWidth:1, maxWidth:2 });
      setSigPad(pad);
    })();
    return ()=>{ videoRef.current?.srcObject?.getTracks()?.forEach(t=>t.stop()); };
  },[]);

  function tomarFoto(){
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d", { alpha:false });
    ctx.drawImage(v,0,0,c.width,c.height);
    c.toBlob(async (blob)=>{
      const file = new File([blob], "foto.jpg", { type:"image/jpeg" });
      const small = await compressImage(file, { maxKB: 400, maxW: 1280, maxH: 1280 });
      setFotoFile(small);
    }, "image/jpeg", 0.92);
  }

  async function enviar(){
    try{
      if(!docente_id || !laboratorio_id) return setMsg("Faltan datos (docente/lab)");
      if(!fotoFile) return setMsg("Toma la foto en vivo");
      if(sigPad.isEmpty()) return setMsg("Falta la firma");
      const sigBlob = await (await fetch(sigRef.current.toDataURL("image/jpeg",0.9))).blob();
      const sigFile = new File([sigBlob], "firma.jpg", { type:"image/jpeg" });

      const form = new FormData();
      form.append("docente_id", docente_id);
      form.append("laboratorio_id", laboratorio_id);
      form.append("origen", origen);
      form.append("foto", fotoFile);
      form.append("firma", sigFile);

      const { data } = await api.post("/asistencias", form, { headers: { "Content-Type":"multipart/form-data" }});
      setMsg(data.ok ? "Asistencia registrada" : (data.msg || "Error"));
    }catch(ex){
      setMsg(ex?.response?.data?.msg || "Error enviando asistencia");
    }
  }

  return (
    <div className="p">
      <h2>Registrar asistencia</h2>
      <div className="row">
        <input placeholder="Docente ID" value={docente_id} onChange={e=>setDocenteId(e.target.value)} />
        <input placeholder="Laboratorio ID" value={laboratorio_id} onChange={e=>setLabId(e.target.value)} />
        <select value={origen} onChange={e=>setOrigen(e.target.value)}>
          <option value="codigo">Código</option>
          <option value="qr">QR</option>
        </select>
      </div>

      <div className="card">
        <video ref={videoRef} style={{maxWidth: "100%"}}/>
        <button onClick={tomarFoto}>Tomar foto en vivo</button>
        <canvas ref={canvasRef} style={{display:"none"}}/>
        <p>{fotoFile ? `Foto lista (${Math.round(fotoFile.size/1024)} KB)` : "Sin foto"}</p>
      </div>

      <div className="card">
        <h3>Firma</h3>
        <canvas ref={sigRef} width={400} height={160} style={{border:"1px solid #ddd", borderRadius:8}}/>
        <button onClick={()=>sigPad?.clear()}>Borrar firma</button>
      </div>

      <button onClick={enviar}>Enviar asistencia</button>
      {msg && <p style={{color: msg.includes("Error")||msg.includes("No")||msg.includes("Falta") ? "crimson" : "green"}}>{msg}</p>}
    </div>
  );
}
