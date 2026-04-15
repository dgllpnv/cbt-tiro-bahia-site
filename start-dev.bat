@echo off
title CBT - Iniciando...
powershell -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Erro ao executar o script.
    echo.
    pause
)
