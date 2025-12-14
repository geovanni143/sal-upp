import { useEffect, useState } from "react";
import { http } from "../api/http";
import { useNavigate } from "react-router-dom";
import "./menu.css";

export default function QRGenerator() {
  const nav = useNavigate();

  const [horarios, setHorarios] = useState([]);
  const [selected, setSelected] = useState("");
  const [qrInfo, setQrInfo] = useState(null); // ← contiene codigo y qr si ya existe

  // Cargar horarios
  useEffect(() => {
    async function load() {
      try {
        const { data } = await http.get("/horarios/lista");
        setHorarios(data.items || []);
      } catch (e) {
        console.error(e);
        alert("No se pudieron cargar los horarios.");
      }
    }
    load();
  }, []);

  // Cuando seleccionas horario
  const onSelectHorario = async (val) => {
    setSelected(val);
    setQrInfo(null);

    if (!val) return;

    const item = horarios.find(
      (h) => `${h.periodo_id}-${h.lab_id}` === val
    );

    if (item && item.codigo_qr) {
      // YA EXISTE QR
      setQrInfo({
        codigo: item.codigo_qr,
        qr: null,
        periodo_id: item.periodo_id,
        lab_id: item.lab_id,
      });

      // Obtener QR real en base64 para mostrarlo
      const { data } = await http.post("/horarios/generar-qr", {
        periodo_id: item.periodo_id,
        lab_id: item.lab_id,
      });

      setQrInfo({
        codigo: data.codigo,
        qr: data.qr,
        periodo_id: item.periodo_id,
        lab_id: item.lab_id,
      });
    }
  };

  // Crear nuevo QR
  const generar = async () => {
    const [periodo_id, lab_id] = selected.split("-");

    const { data } = await http.post("/horarios/generar-qr", {
      periodo_id,
      lab_id,
    });

    setQrInfo({
      codigo: data.codigo,
      qr: data.qr,
      periodo_id,
      lab_id,
    });
  };

  // Descargar PDF
  const descargarPDF = () => {
    const url = `http://localhost:4000/api/horarios/qr-pdf?periodo_id=${qrInfo.periodo_id}&lab_id=${qrInfo.lab_id}`;
    window.open(url, "_blank");
  };

  return (
    <div className="page-shell">
      <div className="menu-card smooth-card" style={{ maxWidth: 680 }}>
        <div className="top-header">
          <button className="btn-back" onClick={() => nav(-1)}>← Regresar</button>
          <h1>Generar QR por Horario</h1>
        </div>

        <p className="hs__muted" style={{ marginBottom: 12 }}>
          Selecciona un horario para generar o descargar su QR.
        </p>

        {/* SELECT */}
        <select
          className="input"
          value={selected}
          onChange={(e) => onSelectHorario(e.target.value)}
        >
          <option value="">Seleccionar horario…</option>

          {horarios.map((h) => (
            <option
              key={`${h.periodo_id}-${h.lab_id}`}
              value={`${h.periodo_id}-${h.lab_id}`}
            >
              {h.periodo_nombre} · {h.lab_nombre} · {h.periodo_ini} — {h.periodo_fin}
            </option>
          ))}
        </select>

        {/* Botón generar QR solo si NO existe */}
        {selected && !qrInfo && (
          <button className="btn" style={{ marginTop: 16 }} onClick={generar}>
            Generar QR
          </button>
        )}

        {/* Botón descargar QR si YA existe */}
        {qrInfo && (
          <button className="btn" style={{ marginTop: 16 }} onClick={descargarPDF}>
            Descargar PDF del QR
          </button>
        )}

        {/* Mostrar QR y código */}
        {qrInfo?.qr && (
          <div style={{ marginTop: 25, textAlign: "center" }}>
            <img src={qrInfo.qr} style={{ width: 330 }} alt="qr" />
            <h2 style={{ marginTop: 8, fontSize: 32 }}>{qrInfo.codigo}</h2>
          </div>
        )}
      </div>
    </div>
  );
}
