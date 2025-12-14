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

  // Cargar docente_id desde storage
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

  // Inicializa cámara
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

    // cleanup: apagar cámara al salir del componente
    return () => {
      try {
        const v = videoRef.current;
        const s = v?.srcObject;
        if (s?.getTracks) s.getTracks().forEach((t) => t.stop());
      } catch {
        // no-op
      }
    };
  }, []);

  // Helper: interpreta lo que viene dentro del QR
  const parseQr = (raw) => {
    try {
      const data = JSON.parse(raw);
      if (data?.scope !== "sal-upp-horario" || data?.version !== 1) {
        throw new Error("QR no reconocido (scope/version).");
      }
      if (!data?.codigo) throw new Error("QR inválido (sin codigo).");

      return {
        codigo: String(data.codigo),
        lab_id: data.lab_id ? String(data.lab_id) : "",
        raw: data,
      };
    } catch {
      if (/^\d{4}$/.test(String(raw))) {
        return { codigo: String(raw), lab_id: "", raw: null };
      }
      throw new Error("QR inválido: formato no soportado.");
    }
  };

  // Escaneo QR en tiempo real
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
        // Dibuja cuadro verde
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

        // Parse QR (JSON)
        try {
          const parsed = parseQr(code.data);

          setForm((prev) => ({
            ...prev,
            codigo: parsed.codigo,
            lab_id: parsed.lab_id || prev.lab_id,
          }));

          setMsgType("ok");
          setMsg(`QR detectado. Código: ${parsed.codigo}`);
          setFound(true);
          setScanning(false);

          setTimeout(() => {
            setFound(false);
            octx.clearRect(0, 0, overlay.width, overlay.height);
          }, 2500);

          clearInterval(interval);
        } catch (e) {
          setMsgType("err");
          setMsg(e.message);
        }
      }
    }, 400);

    return () => clearInterval(interval);
  }, [scanning]);

  const tomarFoto = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || v.readyState !== 4) {
      setMsgType("err");
      setMsg("La cámara aún no está lista.");
      return;
    }

    const w = 640;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    c.width = w;
    c.height = h;

    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, w, h);

    const dataUrl = c.toDataURL("image/jpeg", 0.72);
    setSnap(dataUrl);

    setMsgType("info");
    setMsg("Foto capturada.");
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const firmaVacia = () => {
    const c = firmaRef.current;
    const ctx = c.getContext("2d");
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    // si todos son 0 => canvas vacío
    for (let i = 0; i < img.length; i += 4) {
      if (img[i + 3] !== 0) return false; // alpha != 0
    }
    return true;
  };

  const enviar = async () => {
    try {
      setMsg("");
      setMsgType("info");
      setLoading(true);

      if (!form.docente_id) {
        setMsgType("err");
        return setMsg("Falta docente_id (no se detectó sesión del docente).");
      }
      if (!form.codigo) {
        setMsgType("err");
        return setMsg("Escanea el QR para obtener el código.");
      }
      if (!snap) {
        setMsgType("err");
        return setMsg("Toma la foto en vivo antes de enviar.");
      }
      if (firmaVacia()) {
        setMsgType("err");
        return setMsg("Agrega tu firma antes de enviar.");
      }

      const firmaDataUrl = firmaRef.current.toDataURL("image/png");

      const toFile = (dataUrl, name) => {
        const arr = dataUrl.split(",");
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8 = new Uint8Array(n);
        while (n--) u8[n] = bstr.charCodeAt(n);
        return new File([u8], name, { type: mime });
      };

      const fd = new FormData();
      fd.append("docente_id", form.docente_id);
      fd.append("codigo", form.codigo);
      fd.append("foto", toFile(snap, "foto.jpg"));
      fd.append("firma", toFile(firmaDataUrl, "firma.png"));
// borrar ?test=1
      const resp = await fetch(`${API}/horarios/qr/registrar-evidencia?test=1`, {
      method: "POST",
      body: fd,
      });

      const data = await resp.json();


      if (!resp.ok || !data.ok) {
        setMsgType("err");
        return setMsg(`No se pudo registrar: ${data.msg || "error"}`);
      }

      setMsgType("ok");
      setMsg("Asistencia registrada correctamente con evidencia.");

      // opcional: limpiar foto/firma/código tras éxito
      setSnap(null);
      limpiarFirma();
      // mantiene docente_id y lab_id
      setForm((p) => ({ ...p, codigo: "" }));
    } catch (e) {
      setMsgType("err");
      setMsg(e.message);
    } finally {
      setLoading(false);
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
              color:
                msgType === "ok" ? "#0a7" : msgType === "err" ? "crimson" : "#333",
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

          {snap && (
            <img
              src={snap}
              alt="preview"
              style={{ width: 120, borderRadius: "6px", marginTop: "10px" }}
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
            disabled={loading}
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

          <button className="btn-primary" onClick={enviar} disabled={loading}>
            {loading ? "Registrando..." : "Enviar Registro"}
          </button>
        </div>
      </div>
    </div>
  );
}
