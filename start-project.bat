@echo off
REM =================================================
REM Configurações do projeto
set PROJECT_PATH=C:\agendamento-site
set FRONTEND_PORT=5173
set BACKEND_PORT=3000
REM =================================================

REM Vai para a pasta do projeto
cd /d %PROJECT_PATH%

REM Instala dependências (opcional)
echo Instalando dependências...
npm install

REM Inicia frontend e backend com concurrently em PowerShell
echo Iniciando frontend e backend...
start powershell -NoExit -Command "npm run dev"

REM Espera o frontend estar pronto
:WAIT_FRONTEND
powershell -Command ^
  "$portOpen = Test-NetConnection -ComputerName localhost -Port %FRONTEND_PORT% -InformationLevel Quiet; exit !$portOpen"
if %errorlevel% neq 0 (
    echo Esperando frontend na porta %FRONTEND_PORT%...
    timeout /t 1 /nobreak > nul
    goto WAIT_FRONTEND
)

REM Opcional: esperar backend também (porta 3000)
:WAIT_BACKEND
powershell -Command ^
  "$portOpen = Test-NetConnection -ComputerName localhost -Port %BACKEND_PORT% -InformationLevel Quiet; exit !$portOpen"
if %errorlevel% neq 0 (
    echo Esperando backend na porta %BACKEND_PORT%...
    timeout /t 1 /nobreak > nul
    goto WAIT_BACKEND
)

REM Abre navegador somente agora
start http://localhost:%FRONTEND_PORT%
echo Navegador aberto! Projeto pronto.
