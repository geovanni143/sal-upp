import { pool } from '../db/mysql.js';

const logAction = (entidad) => (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (String(res.statusCode).startsWith('2')) {
        const usuario = req.user?.email || 'system';
        const accion = req.method === 'POST' ? 'CREATE'
                     : req.method === 'PUT'  ? 'UPDATE'
                     : req.method === 'DELETE' ? 'DELETE' : 'OTHER';
        const entidad_id = res.locals?.entityId ?? null;
        const detalle = JSON.stringify({ body: req.body, params: req.params, query: req.query });
        await pool.execute(
          'INSERT INTO bitacora(usuario,accion,entidad,entidad_id,detalle) VALUES(?,?,?,?,?)',
          [usuario, accion, entidad, entidad_id, detalle]
        );
      }
    } catch { /* no romper respuesta */ }
  });
  next();
};

export default logAction;
