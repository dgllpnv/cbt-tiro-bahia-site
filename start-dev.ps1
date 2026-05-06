# =====================================================
# CBT - Clube Baiano de Tiro - Dev Local
# Script de inicializacao defensivo:
#   - Detecta binarios nativos contaminados (Linux quando deveria ser Windows)
#     e reinstala automaticamente
#   - Mata processos antigos nas portas 3002/5173 antes de subir
#   - NAO roda seeds: preserva os dados reais ja migrados
# =====================================================

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "CBT - Dev Local"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---------- HELPERS ----------

function Stop-PortProcess {
    param([int]$Port)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            $owner = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
            if ($owner) {
                Write-Host "  Encerrando processo na porta $Port (PID $($owner.Id) - $($owner.ProcessName))..." -ForegroundColor Yellow
                Stop-Process -Id $owner.Id -Force -ErrorAction SilentlyContinue
                Start-Sleep 1
            }
        }
    } catch {}
}

function Test-BackendBinariesOk {
    param([string]$BackendPath)
    $esbuild = Test-Path "$BackendPath\node_modules\@esbuild\win32-x64\esbuild.exe"
    $prismaClient = Test-Path "$BackendPath\node_modules\@prisma\client\index.js"
    $tsx = Test-Path "$BackendPath\node_modules\tsx\dist\cli.mjs"
    return ($esbuild -and $prismaClient -and $tsx)
}

function Test-FrontendBinariesOk {
    param([string]$FrontendPath)
    $rollup = Test-Path "$FrontendPath\node_modules\@rollup\rollup-win32-x64-msvc"
    $vite = Test-Path "$FrontendPath\node_modules\vite\bin\vite.js"
    return ($rollup -and $vite)
}

function Reset-NodeModules {
    param([string]$Path, [string]$Label)
    Write-Host "  [$Label] node_modules contaminado ou incompleto - reinstalando..." -ForegroundColor Yellow
    if (Test-Path "$Path\node_modules") {
        Remove-Item -Recurse -Force "$Path\node_modules" -ErrorAction SilentlyContinue
    }
    if (Test-Path "$Path\package-lock.json") {
        Remove-Item -Force "$Path\package-lock.json" -ErrorAction SilentlyContinue
    }
    & cmd.exe /c "cd /d `"$Path`" && npm install"
    return $LASTEXITCODE
}

# ---------- HEADER ----------

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  CBT - Clube Baiano de Tiro" -ForegroundColor White
Write-Host "  Setup de Desenvolvimento Local" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL:5434  Backend:3002  Frontend:5173" -ForegroundColor Yellow
Write-Host ""

# ---------- 1. PREREQUISITOS ----------

Write-Host "[1/6] Verificando pre-requisitos..." -ForegroundColor Cyan
& node.exe -v | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO: Node.js nao encontrado!" -ForegroundColor Red; Read-Host; exit 1 }
Write-Host "  Node.js OK" -ForegroundColor Green

& docker.exe info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO: Docker nao esta rodando!" -ForegroundColor Red; Read-Host; exit 1 }
Write-Host "  Docker OK" -ForegroundColor Green

# ---------- 2. POSTGRESQL ----------

Write-Host ""
Write-Host "[2/6] PostgreSQL na porta 5434..." -ForegroundColor Cyan

# Reusa container se ja existe e esta rodando.
$pgRunning = $false
$status = & docker.exe inspect -f "{{.State.Running}}" cbt-postgres 2>$null
if ($status -eq "true") {
    Write-Host "  Container cbt-postgres ja esta rodando - reusando" -ForegroundColor Gray
    $pgRunning = $true
} else {
    Set-Location $ROOT
    & docker.exe compose up -d postgres 2>&1 | Out-Null
}

# Esperar Postgres responder
$ok = $pgRunning
if (-not $ok) {
    for ($i = 1; $i -le 30; $i++) {
        Start-Sleep 1
        & docker.exe exec cbt-postgres pg_isready -U postgres 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
        Write-Host "  Aguardando... ($i/30)" -ForegroundColor Gray
    }
}
if (-not $ok) { Write-Host "ERRO: PostgreSQL nao subiu!" -ForegroundColor Red; Read-Host; exit 1 }
Write-Host "  PostgreSQL PRONTO" -ForegroundColor Green

# ---------- 3. BACKEND DEPS ----------

Write-Host ""
Write-Host "[3/6] Backend..." -ForegroundColor Cyan

Set-Location "$ROOT\backend"

# Garantir que o arquivo .env existe (sem ele, Prisma falha com P1012)
if (-not (Test-Path "$ROOT\backend\.env")) {
    Write-Host "  Criando backend\.env..." -ForegroundColor Yellow
    $envContent = @"
DATABASE_URL=postgresql://postgres:cbt_dev_2024@localhost:5434/cbt_portal
DIRECT_URL=postgresql://postgres:cbt_dev_2024@localhost:5434/cbt_portal
JWT_SECRET=cbt-dev-jwt-secret-key-change-in-production-2024
JWT_EXPIRES_IN=7d
PORT=3002
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:5174
"@
    [System.IO.File]::WriteAllText("$ROOT\backend\.env", $envContent, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  backend\.env criado" -ForegroundColor Green
}

# Detectar contaminacao cross-platform: se faltar @esbuild\win32-x64
# (geralmente porque rodaram npm install em WSL/Linux), reinstala.
if (-not (Test-BackendBinariesOk "$ROOT\backend")) {
    $rc = Reset-NodeModules "$ROOT\backend" "Backend"
    if ($rc -ne 0) {
        Write-Host "ERRO: npm install backend falhou!" -ForegroundColor Red
        Read-Host; exit 1
    }
    & cmd.exe /c "cd /d `"$ROOT\backend`" && npx prisma generate" 2>&1 | Out-Null
    Write-Host "  Backend reinstalado com binarios Windows" -ForegroundColor Green
} else {
    Write-Host "  Dependencias OK (binarios Windows presentes)" -ForegroundColor Green
}

# Fallback: exportar variaveis do .env para o processo atual
Get-Content "$ROOT\backend\.env" | ForEach-Object {
    if ($_ -match "^\s*([^#=\s]+)\s*=\s*(.*)$") {
        $name = $matches[1]
        $value = $matches[2].Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Prisma db push: idempotente, nao apaga dados.
Write-Host "  Aplicando schema no banco (sem alterar dados)..." -ForegroundColor Gray
& cmd.exe /c "cd /d `"$ROOT\backend`" && npx prisma db push"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha ao aplicar schema!" -ForegroundColor Red
    Read-Host; exit 1
}
Write-Host "  Schema OK" -ForegroundColor Green

# Seed DESATIVADO - preserva os dados reais ja migrados.
Write-Host "  Seed DESATIVADO - banco preservado." -ForegroundColor Yellow
Write-Host "  Para popular do zero: rode npm run db:seed:all dentro de backend" -ForegroundColor DarkGray

# ---------- 4. FRONTEND DEPS ----------

Write-Host ""
Write-Host "[4/6] Frontend..." -ForegroundColor Cyan

Set-Location "$ROOT\frontend"

if (-not (Test-Path "$ROOT\frontend\.env")) {
    Write-Host "  Criando frontend\.env..." -ForegroundColor Yellow
    [System.IO.File]::WriteAllText("$ROOT\frontend\.env", "VITE_API_URL=http://localhost:3002`n", [System.Text.UTF8Encoding]::new($false))
    Write-Host "  frontend\.env criado" -ForegroundColor Green
}

if (-not (Test-FrontendBinariesOk "$ROOT\frontend")) {
    $rc = Reset-NodeModules "$ROOT\frontend" "Frontend"
    if ($rc -ne 0) {
        Write-Host "ERRO: npm install frontend falhou!" -ForegroundColor Red
        Read-Host; exit 1
    }
    Write-Host "  Frontend reinstalado com binarios Windows" -ForegroundColor Green
} else {
    Write-Host "  Dependencias OK (binarios Windows presentes)" -ForegroundColor Green
}

# ---------- 5. INICIAR BACKEND ----------

Write-Host ""
Write-Host "[5/6] Iniciando Backend (porta 3002)..." -ForegroundColor Cyan

# Mata qualquer processo zumbi na 3002 antes de subir o novo
Stop-PortProcess -Port 3002

Start-Process cmd.exe -ArgumentList "/k title CBT-Backend && color 0E && cd /d `"$ROOT\backend`" && npm run dev"
Write-Host "  Backend iniciando em janela amarela..." -ForegroundColor Green

$beOk = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep 2
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3002/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $beOk = $true; break }
    } catch {}
    Write-Host "  Aguardando backend... ($i/30)" -ForegroundColor Gray
}
if ($beOk) { Write-Host "  Backend PRONTO" -ForegroundColor Green }
else { Write-Host "  Backend demorou - verifique janela amarela" -ForegroundColor Yellow }

# ---------- 6. INICIAR FRONTEND ----------

Write-Host ""
Write-Host "[6/6] Iniciando Frontend (porta 5173)..." -ForegroundColor Cyan

Stop-PortProcess -Port 5173

Start-Process cmd.exe -ArgumentList "/k title CBT-Frontend && color 0B && cd /d `"$ROOT\frontend`" && npx vite --port 5173 --host"
Write-Host "  Frontend iniciando em janela azul..." -ForegroundColor Green

Start-Sleep 5

# ---------- PRONTO ----------

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  TUDO PRONTO!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Site:      http://localhost:5173" -ForegroundColor Yellow
Write-Host "  Portal:    http://localhost:5173/login" -ForegroundColor Yellow
Write-Host "  API:       http://localhost:3002/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Admin:     admin@cbt.com.br / admin123" -ForegroundColor Cyan
Write-Host "  Associado: associado@cbt.com.br / associado123" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:5173"

Write-Host "Pressione Enter para ENCERRAR tudo..." -ForegroundColor Red
Read-Host

# Encerra apenas processos nas portas do CBT (preserva VSCode/outros nodes do sistema)
Stop-PortProcess -Port 3002
Stop-PortProcess -Port 5173

Write-Host "Encerrado. Para parar PostgreSQL: docker compose down" -ForegroundColor Gray
Read-Host "Enter para fechar"
