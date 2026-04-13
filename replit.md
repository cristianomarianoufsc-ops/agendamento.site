# Agendamento UFSC - Sistema de Agendamento de Espaços Culturais

## Overview
A web-based scheduling and management system for cultural spaces at UFSC (Federal University of Santa Catarina). Users can book venues (Teatro Carmen Fossari, Igrejinha da UFSC) for events, with admin evaluation and Google Calendar sync.

## Tech Stack
- **Frontend:** React 19 + Vite, Tailwind CSS, Framer Motion, React Router Dom
- **Backend:** Node.js + Express 5, runs on port 10000
- **Database:** PostgreSQL (Replit built-in, via `DATABASE_URL`)
- **Integrations:** Google Calendar/Sheets/Drive (googleapis), Email (Nodemailer/Resend/Brevo), PDF generation (PDFKit/jsPDF)

## Architecture
- Frontend (Vite dev server) runs on port **5000** (Replit webview)
- Backend (Express) runs on port **10000**
- Vite proxies `/api` requests to the backend at `localhost:10000`
- In production: backend serves the built frontend from `backend/public/`

## Project Structure
```
/
├── src/              # React frontend source
├── backend/
│   ├── server.js     # Main Express server (port 10000)
│   └── pdfGenerator.js
├── public/           # Static frontend assets
├── vite.config.js    # Vite config (port 5000, proxy to 10000)
└── package.json
```

## Development
- `npm run dev` — Starts both the backend server and Vite dev server
- Frontend: http://localhost:5000
- Backend API: http://localhost:10000

## Environment Variables
- `DATABASE_URL` — Replit PostgreSQL connection string (auto-set)
- `RESEND_API_KEY` — Email via Resend (optional)
- `BREVO_API_KEY` / `BREVO_SMTP_USER` / `BREVO_SMTP_KEY` — Email via Brevo (optional)
- `EMAIL_USER` / `EMAIL_PASS` — Gmail SMTP (optional)
- `GOOGLE_CREDENTIALS_JSON` — Google service account JSON (optional, for Calendar sync)

## Database
Tables are auto-created on startup via `initializeTables()`:
- `inscricoes` — Event registrations
- `evaluators` — Admin evaluators
- `assessments` — Evaluation scores
- `evaluation_criteria` — Scoring criteria
- `config` — App configuration

## Deployment
- Build: `npm run build` (compiles frontend to `backend/public/`)
- Run: `node backend/server.js` (serves both API and static frontend)
- Target: autoscale
