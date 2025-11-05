// backend/src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import './db/mysql.js';

import authRoutes from './routes/auth.routes.js';
import labsRoutes from './routes/labs.routes.js';
import usersRoutes from './routes/users.routes.js';
import periodosRoutes from './routes/periodos.routes.js';
import horariosRoutes from './routes/horarios.routes.js';

const app = express();
app.use(cors());
app.use(express.json());                      // <— necesario
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve('uploads')));

// Montaje correcto:
app.use('/api', authRoutes);                  // <— esto hace POST /api/login
app.use('/api/labs', labsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/periodos', periodosRoutes);
app.use('/api/horarios', horariosRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`SAL-UPP backend :${PORT}`));
