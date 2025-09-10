@echo off
echo Iniciando servidor BACKEND...
start cmd /k "cd /d C:\agendamento-site\backend && node server.js"

echo Iniciando servidor FRONTEND...
start cmd /k "cd /d C:\agendamento-site && npm install && npm install date-fns date-fns-tz && npm run dev"

timeout /t 3 >nul
start http://localhost:5173/
