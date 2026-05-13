@echo off
setlocal
title CBT - Iniciando...

set "PS1=%~dp0start-dev.ps1"

if not exist "%PS1%" (
    echo.
    echo ERRO: start-dev.ps1 nao encontrado em %~dp0
    echo Verifique se voce esta executando este .bat da pasta raiz do projeto.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"

if %errorlevel% neq 0 (
    echo.
    echo =====================================================
    echo  Erro ao executar start-dev.ps1 ^(codigo %errorlevel%^)
    echo =====================================================
    echo  Troubleshooting comum:
    echo    1. Docker Desktop nao esta rodando ^(abra e aguarde healthy^)
    echo    2. Node.js nao instalado ^(https://nodejs.org, v22 LTS^)
    echo    3. Antivirus bloqueando node_modules ^(adicione excecao^)
    echo    4. Portas 3002/5173/5434 ocupadas
    echo.
    echo  Logs do npm: %%TEMP%%\cbt-dev-logs
    echo.
    pause
)

endlocal
