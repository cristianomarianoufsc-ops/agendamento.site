@echo off
REM =================================================
REM Configurações do projeto
set PROJECT_PATH=C:\agendamento-site
REM =================================================

REM Vai para a pasta do projeto
cd /d %PROJECT_PATH%

REM Instala dependências do frontend
echo Instalando dependências do frontend...
call powershell -Command "npm install"

REM Inicia frontend em uma janela separada
start "Frontend" powershell -NoExit -Command "npm run dev"

REM Vai para a pasta backend
cd backend

REM Instala dependências do backend
echo Instalando dependências do backend...
call powershell -Command "npm install"

REM Inicia backend em uma janela separada
start "Backend" powershell -NoExit -Command "npm run dev"

echo ============================================
echo ✅ Frontend e backend foram iniciados!
echo ============================================
pause
