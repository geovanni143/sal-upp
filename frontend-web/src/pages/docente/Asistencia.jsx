// Asistencia.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import "./docente.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export default function Asistencia() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const firmaRef = useRef(null);

  const [snap, setSnap] = useState(null);
  const [firmaPreview, setFirmaPreview] = useState(null);
  //const [mostrarFirma, setMostrarFirma] = useState(false);

  const [form, setForm] = useState({ docente_id: "", lab_id: "", codigo: "" });
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [qrFlash, setQrFlash] = useState(false);
  const [modalFirma, setModalFirma] = useState(false);
  const [qrSuccess, setQrSuccess] = useState(false);
  /* ===============================
     Cargar docente_id
  =============================== */
  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) {
        const user = JSON.parse(u);
        if (user?.id) setForm((p) => ({ ...p, docente_id: String(user.id) }));
      }

      const uid = localStorage.getItem("user_id");
      if (uid) setForm((p) => ({ ...p, docente_id: String(uid) }));
    } catch {}
  }, []);

  /* ===============================
     Inicializar cámara
  =============================== */
  useEffect(() => {
    let stream;

    const iniciarCamara = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setMsgType("err");
        setMsg("No se pudo acceder a la cámara");
      }
    };

    iniciarCamara();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  /* ===============================
     Sonido QR
  =============================== */
  const playBeep = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  };

  /* ===============================
     Parse QR
  =============================== */
  const parseQr = (raw) => {
    try {
      const data = JSON.parse(raw);
      if (data?.scope !== "sal-upp-horario" || data?.version !== 1)
        throw new Error("QR no reconocido.");
      if (!data?.codigo) throw new Error("QR inválido.");
      return {
        codigo: String(data.codigo),
        lab_id: data.lab_id ? String(data.lab_id) : "",
      };
    } catch {
      if (/^\d{4}$/.test(String(raw)))
        return { codigo: String(raw), lab_id: "" };
      throw new Error("QR inválido.");
    }
  };

  /* ===============================
     Escaneo automático QR
  =============================== */
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let interval;

    const iniciarEscaneo = () => {
      interval = setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState !== 4) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          try {
            const parsed = parseQr(code.data);

            setForm(p => ({
              ...p,
              codigo: parsed.codigo,
              lab_id: parsed.lab_id || p.lab_id
            }));

            setMsgType("ok");
            setMsg(`QR detectado. Código: ${parsed.codigo}`);

            // 🎯 Marco verde
            const overlay = overlayRef.current;
            const octx = overlay.getContext("2d");
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;

            const loc = code.location;
            octx.strokeStyle = "lime";
            octx.lineWidth = 4;
            octx.beginPath();
            octx.moveTo(loc.topLeftCorner.x, loc.topLeftCorner.y);
            octx.lineTo(loc.topRightCorner.x, loc.topRightCorner.y);
            octx.lineTo(loc.bottomRightCorner.x, loc.bottomRightCorner.y);
            octx.lineTo(loc.bottomLeftCorner.x, loc.bottomLeftCorner.y);
            octx.closePath();
            octx.stroke();

            playBeep();
            setQrFlash(true);
            setTimeout(() => setQrFlash(false), 600);
            if (navigator.vibrate) navigator.vibrate(100);
            setQrSuccess(true);
            setTimeout(() => setQrSuccess(false), 2000);
            clearInterval(interval);
            // limpiar marco verde después de 800ms
setTimeout(() => {
  const overlay = overlayRef.current;
  if (overlay) {
    const octx = overlay.getContext("2d");
    octx.clearRect(0, 0, overlay.width, overlay.height);
  }
}, 800);
          } catch (e) {
            setMsgType("err");
            setMsg(e.message);
          }
        }
      }, 400);
    };

    const video = videoRef.current;
    if (video) video.addEventListener("loadeddata", iniciarEscaneo);

    return () => interval && clearInterval(interval);
  }, []);

  /* ===============================
     Foto
  =============================== */
  const tomarFoto = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || v.readyState !== 4) {
      setMsgType("err");
      setMsg("La cámara no está lista.");
      return;
    }

    const w = 640;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    c.width = w;
    c.height = h;

    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, w, h);
    setSnap(c.toDataURL("image/jpeg", 0.72));
  };

  /* ===============================
     Firma
  =============================== */
  const [firmando, setFirmando] = useState(false);

  const getPosFirma = (e) => {
    const rect = firmaRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const iniciarFirma = (e) => {
    e.preventDefault();
    setFirmando(true);
    const ctx = firmaRef.current.getContext("2d");
    const { x, y } = getPosFirma(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const dibujarFirma = (e) => {
    if (!firmando) return;
    e.preventDefault();
    const ctx = firmaRef.current.getContext("2d");
    const { x, y } = getPosFirma(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const terminarFirma = () => setFirmando(false);

  const limpiarFirma = () => {
    const c = firmaRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    setFirmaPreview(null);
  };

  const firmaVacia = () => {
    const c = firmaRef.current;
    const ctx = c.getContext("2d");
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < img.length; i += 4)
      if (img[i + 3] !== 0) return false;
    return true;
  };

  /* ===============================
     Enviar
  =============================== */
  const enviar = async () => {
    try {
      setLoading(true);
      setMsg("");

      if (!form.docente_id) throw new Error("No se detectó el docente.");
      if (!form.codigo) throw new Error("Escanea el QR.");
      if (!snap) throw new Error("Toma la foto.");
      if (firmaVacia()) throw new Error("Agrega tu firma.");

      const firmaDataUrl = firmaRef.current.toDataURL("image/png");
      setFirmaPreview(firmaDataUrl);
      setMostrarFirma(false);

      const toFile = (dataUrl, name) => {
        const arr = dataUrl.split(",");
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        const u8 = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        return new File([u8], name, { type: mime });
      };

      const fd = new FormData();
      fd.append("docente_id", form.docente_id);
      fd.append("codigo", form.codigo);
      fd.append("foto", toFile(snap, "foto.jpg"));
      fd.append("firma", toFile(firmaDataUrl, "firma.png"));

      const resp = await fetch(`${API}/horarios/qr/registrar-evidencia`, {
        method: "POST",
        body: fd,
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.msg || "Error");

      setMsgType("ok");
      setMsg("Asistencia registrada correctamente.");
      setSnap(null);
      limpiarFirma();
      setForm((p) => ({ ...p, codigo: "" }));
    } catch (e) {
      setMsgType("err");
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     UI
  =============================== */
  return (
    <div className="page-shell">
      <div className="menu-card asistencia-card">

        <button className="back-btn" onClick={() => navigate("/docente")}>
          ←
        </button>

        <h2 className="center-title">Registro de Asistencia</h2>
{qrSuccess && (
  <div className="qr-success-check">
    ✔ QR validado correctamente
  </div>
)}
        {msg && (
          <p style={{ color: msgType === "ok" ? "#0a7" : "crimson" }}>
            {msg}
          </p>
        )}

<div className="camera-wrapper">
  <video
    ref={videoRef}
    className="camera-view"
    autoPlay
    playsInline
    muted
  />
  <canvas ref={overlayRef} className="camera-overlay" />
  {qrFlash && <div className="qr-flash" />}
</div>

        <div className="row gap mt">
            <h4 style={{ marginBottom: "8px" }}>Tomar foto de evidencia del aula</h4>

<button
  className={`btn-secondary-ghost ${snap ? "btn-success" : ""}`}
  onClick={tomarFoto}
  disabled={loading}
>
  {snap ? "✔ Foto capturada" : "Capturar foto"}
</button>
        </div>

        {snap && <img src={snap} alt="preview" width={120} />}
        <canvas ref={canvasRef} hidden />

        {/* FIRMA */}
<div className="firma-section">

  <button
    className="btn-secondary-ghost small"
    onClick={() => setModalFirma(true)}
  >
    {firmaPreview ? "Editar Firma" : "Agregar Firma"}
  </button>

  {firmaPreview && (
    <img
      src={firmaPreview}
      alt="Firma"
      width={160}
      style={{
        marginTop: "10px",
        borderRadius: "8px",
        background: "#fff",
        padding: "6px"
      }}
    />
  )}

</div>
        <input
          placeholder="Código / QR"
          value={form.codigo}
          onChange={(e) =>
            setForm({ ...form, codigo: e.target.value })
          }
        />

        <button
          className="btn-primary"
          onClick={enviar}
          disabled={loading}
        >
          {loading ? "Registrando..." : "Enviar Registro"}
        </button>
{modalFirma && (
  <div className="modal-overlay">
    <div className="modal-box">

      <h3>Firma del Docente</h3>

      <canvas
        ref={firmaRef}
        width={320}
        height={180}
        className="firma-canvas"
        onPointerDown={iniciarFirma}
        onPointerMove={dibujarFirma}
        onPointerUp={terminarFirma}
        onPointerLeave={terminarFirma}
        style={{ touchAction: "none" }}
      />

      <div className="modal-buttons">
        <button
          onClick={() => {
            if (!firmaVacia()) {
              const firmaData = firmaRef.current.toDataURL("image/png");
              setFirmaPreview(firmaData);
            }
            setModalFirma(false);
          }}
        >
          Guardar
        </button>

        <button onClick={limpiarFirma}>
          Limpiar
        </button>
      </div>

    </div>
  </div>
)}
      </div>
    </div>
  );
}