export default function Forbidden() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'grid',
      placeItems: 'center',
      background: '#F5F6FA',
      padding: 24
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 8px 30px rgba(0,0,0,.08)',
        maxWidth: 480,
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: 28, color: '#1E1E1E' }}>403 • Acceso denegado</h1>
        <p style={{ color: '#6B7280', marginTop: 12 }}>
          No tienes permisos para ver esta sección. Inicia sesión con un rol autorizado.
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent:'center' }}>
          <a href="/login" style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            textDecoration: 'none'
          }}>Ir al login</a>
          <a href="/" style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: '#3E0E6A',
            color: '#fff',
            textDecoration: 'none'
          }}>Volver al inicio</a>
        </div>
      </div>
    </div>
  );
}
