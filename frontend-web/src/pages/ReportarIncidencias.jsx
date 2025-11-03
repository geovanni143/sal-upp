// src/pages/ReportarIncidencias.jsx
import React from 'react';

export default function ReportarIncidencias() {
  return (
    <div>
      <h1>Reportar Incidencia</h1>
      <form>
        {/* Aquí iría el formulario para reportar incidencias */}
        <label>Descripción de la incidencia:</label>
        <textarea placeholder="Describe la incidencia" required></textarea>
        <button type="submit">Enviar Reporte</button>
      </form>
    </div>
  );
}
