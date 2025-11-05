import { useEffect, useRef, useState } from "react";
import "./docente.css";

export default function Asistencia() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const firmaRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [form, setForm] = useState({ docente_id: "", lab_id: "", codigo: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      })
      .catch(() => setMsg("No se pudo acceder a la cámara"));
  }, []);

  const tomarFoto = () => {
    const v = videoRef.current,
      c = canvasRef.current;
    const w = 640,
      h = Math.round((v.videoHeight / v.videoWidth) * w);
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", 0.72);
    setSnap(dataUrl);
  };

  const limpiarFirma = () => {
    const c = firmaRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
  };

  const dibujarFirma = (e) => {
    if (e.buttons !== 1) return;
    const c = firmaRef.current;
    const ctx = c.getContext("2d");
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const enviar = async () => {
    try {
      setMsg("");
      if (!snap) return setMsg("Toma la foto en vivo");
      const firmaData = firmaRef.current.toDataURL("image/png");

      const toFile = (dataUrl, name) => {
        const arr = dataUrl.split(","),
          mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8 = new Uint8Array(n);
        while (n--) u8[n] = bstr.charCodeAt(n);
        return new File([u8], name, { type: mime });
      };

      const fd = new FormData();
      fd.append("docente_id", form.docente_id);
      fd.append("lab_id", form.lab_id);
      fd.append("codigo", form.codigo);
      fd.append("foto", toFile(snap, "foto.jpg"));
      fd.append("firma", toFile(firmaData, "firma.png"));

      // Ejemplo de petición (ajusta tu función real de subida)
      const r = await fetch("/api/asistencia/registrar", {
        method: "POST",
        body: fd,
      });
      const data = await r.json();
      setMsg(`${data.mensaje || "Registro enviado"} (${data.estado || "OK"})`);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <div className="page-shell">
      <div className="menu-card asistencia-card">
        <div className="menu-head">
          <div className="brand">SAL-UPP</div>
          <div className="menu-sub">Docente</div>
        </div>

        <h2 className="center-title">Registro de Asistencia</h2>

        {msg && (
          <p
            style={{
              color: msg.includes("OK") ? "#0a7" : "crimson",
              fontWeight: 600,
            }}
          >
            {msg}
          </p>
        )}

        <div className="camera-section">
          <video ref={videoRef} className="camera-view" />
          <div className="row gap mt">
            <button className="btn-primary small" onClick={tomarFoto}>
              Tomar Foto
            </button>
            {snap && (
              <img
                src={snap}
                alt="preview"
                style={{ width: 120, borderRadius: "6px" }}
              />
            )}
          </div>
          <canvas ref={canvasRef} hidden />
        </div>

        <div className="firma-section">
          <h4>Firma del Docente</h4>
          <canvas
            ref={firmaRef}
            width={320}
            height={180}
            className="firma-canvas"
            onMouseMove={dibujarFirma}
          />
          <button
            type="button"
            className="btn-secondary-ghost small"
            onClick={limpiarFirma}
          >
            Limpiar Firma
          </button>
        </div>

        <div className="form mt">
          <input
            placeholder="ID Docente"
            value={form.docente_id}
            onChange={(e) => setForm({ ...form, docente_id: e.target.value })}
          />
          <input
            placeholder="ID Laboratorio"
            value={form.lab_id}
            onChange={(e) => setForm({ ...form, lab_id: e.target.value })}
          />
          <input
            placeholder="Código / QR"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          />
          <button className="btn-primary" onClick={enviar}>
            Enviar Registro
          </button>
        </div>
      </div>
    </div>
  );
}
