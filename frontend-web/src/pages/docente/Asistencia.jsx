// Asistencia.jsx
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import "./docente.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export default function Asistencia() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const firmaRef = useRef(null);

  const [snap, setSnap] = useState(null);
  const [form, setForm] = useState({ docente_id: "", lab_id: "", codigo: "" });

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info"); // info | ok | err
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState(false);
  const [loading, setLoading] = useState(false);

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
    } catch {
      // no-op
    }
  }, []);

  /* ===============================
     Inicializar cámara
  =============================== */
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      })
      .catch(() => {
        setMsgType("err");
        setMsg("No se pudo acceder a la cámara");
      });

    return () => {
      try {
        const v = videoRef.current;
        const s = v?.srcObject;
        if (s?.getTracks) s.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  /* ===============================
     Parse QR
  =============================== */
  const parseQr = (raw) => {
    try {
      const data = JSON.parse(raw);
      if (data?.scope !== "sal-upp-horario" || data?.version !== 1) {
        throw new Error("QR no reconocido.");
      }
      if (!data?.codigo) throw new Error("QR inválido.");
      return {
        codigo: String(data.codigo),
        lab_id: data.lab_id ? String(data.lab_id) : "",
      };
    } catch {
      if (/^\d{4}$/.test(String(raw))) {
        return { codigo: String(raw), lab_id: "" };
      }
      throw new Error("QR inválido.");
    }
  };

  /* ===============================
     Escaneo QR
  =============================== */
  useEffect(() => {
    if (!scanning) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const overlay = overlayRef.current;
    const octx = overlay.getContext("2d");

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      octx.clearRect(0, 0, overlay.width, overlay.height);

      if (code) {
        try {
          const parsed = parseQr(code.data);

          setForm((p) => ({
            ...p,
            codigo: parsed.codigo,
            lab_id: parsed.lab_id || p.lab_id,
          }));

          setMsgType("ok");
          setMsg(`QR detectado. Código: ${parsed.codigo}`);
          setFound(true);
          setScanning(false);

          setTimeout(() => setFound(false), 2000);
          clearInterval(interval);
        } catch (e) {
          setMsgType("err");
          setMsg(e.message);
        }
      }
    }, 400);

    return () => clearInterval(interval);
  }, [scanning]);

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
     FIRMA (PC + MÓVIL)
  =============================== */
  let firmando = false;

  const getPosFirma = (e) => {
    const rect = firmaRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const iniciarFirma = (e) => {
    e.preventDefault();
    firmando = true;
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

  const terminarFirma = () => {
    firmando = false;
  };

  const limpiarFirma = () => {
    const c = firmaRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
  };

  const firmaVacia = () => {
    const c = firmaRef.current;
    const ctx = c.getContext("2d");
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < img.length; i += 4) {
      if (img[i + 3] !== 0) return false;
    }
    return true;
  };

  /* ===============================
     Enviar asistencia
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
      fd.append("horario_id", form.horario_id);
      fd.append("foto", toFile(snap, "foto.jpg"));
      fd.append("firma", toFile(firmaDataUrl, "firma.png"));

      const resp = await fetch(`${API}/asistencias/registrar`, {

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
        <h2 className="center-title">Registro de Asistencia</h2>

        {msg && (
          <p style={{ color: msgType === "ok" ? "#0a7" : msgType === "err" ? "crimson" : "#333" }}>
            {msg}
          </p>
        )}

        <div className="camera-section">
          <video ref={videoRef} className="camera-view" />
          <canvas ref={overlayRef} className="camera-overlay" />

          <div className="row gap mt">
<button
  className="btn-primary small"
  onClick={() => setScanning((p) => !p)}
  disabled={loading}
>
  {scanning ? "Escaneando..." : "Escanear QR"}
</button>

<button
  className="btn-secondary-ghost small"
  onClick={tomarFoto}
  disabled={loading}
>
  Tomar Foto
</button>

          </div>

          {snap && <img src={snap} alt="preview" width={120} />}
          <canvas ref={canvasRef} hidden />
        </div>

        <div className="firma-section">
          <h4>Firma del Docente</h4>
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
<button
  type="button"
  className="btn-secondary-ghost small"
  onClick={limpiarFirma}
  disabled={loading}
>
  Limpiar Firma
</button>

        </div>

        <input
          placeholder="Código / QR"
          value={form.codigo}
          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
        />

 <button
  className="btn-primary"
  onClick={enviar}
  disabled={loading}
>
  {loading ? "Registrando..." : "Enviar Registro"}
</button>

      </div>
    </div>
  );
}
