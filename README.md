# SAL-UPP (Sistema de Asistencia UPP)

Monorepo:
- **backend/** Node.js + Express + MySQL (JWT, Labs, QR)
- **frontend-web/** React + Vite (Login, Dashboard, Generar QR)

## Dev rápido
API:
\\\ash
cd backend && npm i && npm run dev
\\\
Web:
\\\ash
cd frontend-web && npm i && npm run dev
\\\

## Variables
**backend/.env** usa **backend/.env.example**  
**frontend-web/.env.local** usa **frontend-web/.env.example**

## Endpoints
- POST /api/auth/login
- GET  /api/labs (Bearer)
- POST /api/qr/generate (Bearer)
- POST /api/asistencias/qr (Bearer)
- GET  /api/asistencias?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&lab=1 (Bearer)

## Migraciones
- db/migrations/001_schema.sql
- db/migrations/002_asistencia.sql
