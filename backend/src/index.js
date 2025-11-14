// src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import labsRoutes from './routes/labs.routes.js';
import periodosRoutes from './routes/periodos.routes.js';
import horariosRoutes from './routes/horarios.routes.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.resolve('uploads')));

/* Montaje API (sin comodines raros) */
app.use('/api', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/labs', labsRoutes);
app.use('/api/periodos', periodosRoutes);
app.use('/api/horarios', horariosRoutes);

app.get('/api/health', (_req,res)=>res.json({ok:true}));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, ()=>{
  console.log('----------------------------------------');
  console.log('  SAL-UPP backend corriendo en :', PORT);
  console.log('  CORS permitido desde          : http://localhost:5173');
  console.log('----------------------------------------');
});
