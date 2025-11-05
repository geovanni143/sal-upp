import { useEffect, useRef, useState } from 'react';

export default function Asistencia(){
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const firmaRef = useRef(null);
  const [snap,setSnap]=useState(null);
  const [form,setForm]=useState({docente_id:'', lab_id:'', codigo:''});
  const [msg,setMsg]=useState('');

  useEffect(()=>{
    navigator.mediaDevices.getUserMedia({video:true}).then(stream=>{
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }).catch(()=> setMsg('No se pudo acceder a la cámara'));
  },[]);

  const tomarFoto=()=>{
    const v = videoRef.current, c = canvasRef.current;
    const w = 640, h = Math.round((v.videoHeight/v.videoWidth)*w);
    c.width=w; c.height=h;
    const ctx = c.getContext('2d');
    ctx.drawImage(v,0,0,w,h);
    // compresión (calidad 0.72)
    const dataUrl = c.toDataURL('image/jpeg', 0.72);
    setSnap(dataUrl);
  };

  const limpiarFirma=()=> {
    const c=firmaRef.current; const ctx=c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
  };
  const dibujarFirma=(e)=>{
    if (e.buttons!==1) return;
    const c=firmaRef.current; const ctx=c.getContext('2d');
    const rect=c.getBoundingClientRect();
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    ctx.lineWidth=2; ctx.lineCap='round'; ctx.strokeStyle='#111';
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+0.1,y+0.1); ctx.stroke();
  };

  const enviar=async()=>{
    try{
      setMsg('');
      if(!snap) return setMsg('Toma la foto en vivo');
      const firmaData = firmaRef.current.toDataURL('image/png');

      // convierte base64 a File
      const toFile=(dataUrl,name)=> {
        const arr=dataUrl.split(','), mime=arr[0].match(/:(.*?);/)[1];
        const bstr=atob(arr[1]); let n=bstr.length; const u8=new Uint8Array(n);
        while(n--) u8[n]=bstr.charCodeAt(n);
        return new File([u8], name, {type:mime});
      };

      const fd = new FormData();
      fd.append('docente_id', form.docente_id);
      fd.append('lab_id', form.lab_id);
      fd.append('codigo', form.codigo); // (placeholder para QR/código)
      fd.append('foto', toFile(snap, 'foto.jpg'));
      fd.append('firma', toFile(firmaData, 'firma.png'));

      const r = await uploadForm('/asistencia/registrar', fd);
      setMsg(`${r.mensaje} (estado: ${r.estado})`);
    }catch(e){ setMsg(e.message); }
  };

  return (
    <div className="page">
      <h2>Registro de asistencia (foto + firma)</h2>
      {msg && <p style={{color: msg.includes('estado')?'#0a7':'crimson'}}>{msg}</p>}

      <div className="row gap">
        <div>
          <video ref={videoRef} style={{width:320, height:240, background:'#000'}}/>
          <div className="row gap mt">
            <button onClick={tomarFoto}>Tomar foto</button>
            {snap && <img src={snap} alt="preview" style={{width:120}}/>}
          </div>
          <canvas ref={canvasRef} hidden />
        </div>

        <div>
          <canvas
            ref={firmaRef}
            width={320} height={180}
            style={{border:'1px solid #ccc', background:'#fff'}}
            onMouseMove={dibujarFirma}
          />
          <div className="row gap mt">
            <button type="button" onClick={limpiarFirma}>Limpiar firma</button>
          </div>
        </div>
      </div>

      <div className="row gap mt">
        <input placeholder="ID Docente" value={form.docente_id} onChange={e=>setForm({...form,docente_id:e.target.value})}/>
        <input placeholder="ID Lab" value={form.lab_id} onChange={e=>setForm({...form,lab_id:e.target.value})}/>
        <input placeholder="Código/QR" value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value})}/>
        <button onClick={enviar}>Enviar registro</button>
      </div>
    </div>
  );
}
