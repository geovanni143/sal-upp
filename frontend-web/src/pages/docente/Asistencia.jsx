import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import "./docente.css";

export default function Asistencia() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const firmaRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [form, setForm] = useState({ docente_id: "", lab_id: "", codigo: "" });
  const [msg, setMsg] = useState("");
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState(false);

  // Inicializa cámara
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      })
      .catch(() => setMsg("No se pudo acceder a la cámara"));
  }, []);

  // Escanear QR en tiempo real con animación
  useEffect(() => {
    if (!scanning) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const overlay = overlayRef.current;
    const octx = overlay.getContext("2d");

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) return;

      // Dibuja el frame actual
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Detecta QR
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      // Limpia overlay
      octx.clearRect(0, 0, overlay.width, overlay.height);

      if (code) {
        // Convierte coordenadas a proporción del canvas visible
        const scaleX = overlay.width / canvas.width;
        const scaleY = overlay.height / canvas.height;
        const drawLine = (begin, end) => {
          octx.moveTo(begin.x * scaleX, begin.y * scaleY);
          octx.lineTo(end.x * scaleX, end.y * scaleY);
        };

        octx.beginPath();
        octx.lineWidth = 4;
        octx.strokeStyle = "#00ff00";
        drawLine(code.location.topLeftCorner, code.location.topRightCorner);
        drawLine(code.location.topRightCorner, code.location.bottomRightCorner);
        drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner);
        drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner);
        octx.stroke();

        // Muestra mensaje visual
        setForm((prev) => ({ ...prev, codigo: code.data }));
        setMsg(`Código detectado: ${code.data}`);
        setFound(true);
        setScanning(false);

        // Limpia animación luego de 2.5 segundos
        setTimeout(() => {
          setFound(false);
          octx.clearRect(0, 0, overlay.width, overlay.height);
        }, 2500);

        clearInterval(interval);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [scanning]);

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
              marginTop: 4,
            }}
          >
            {msg}
          </p>
        )}

        <div className="camera-section">
          <div className="camera-wrapper">
            <video ref={videoRef} className="camera-view" />
            <canvas ref={overlayRef} className="camera-overlay" />
            {found && <div className="qr-found">✅ Código Detectado</div>}
          </div>

          <div className="row gap mt">
            <button
              className="btn-primary small"
              onClick={() => setScanning((prev) => !prev)}
            >
              {scanning ? "Escaneando..." : "Escanear QR"}
            </button>
            <button className="btn-secondary-ghost small" onClick={tomarFoto}>
              Tomar Foto
            </button>
          </div>

          {snap && (
            <img
              src={snap}
              alt="preview"
              style={{
                width: 120,
                borderRadius: "6px",
                marginTop: "10px",
              }}
            />
          )}
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
