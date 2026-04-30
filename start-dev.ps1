# =====================================================
# CBT - Clube Baiano de Tiro - Dev Local
# =====================================================

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "CBT - Dev Local"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  CBT - Clube Baiano de Tiro" -ForegroundColor White
Write-Host "  Setup de Desenvolvimento Local" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL:5434  Backend:3002  Frontend:5173" -ForegroundColor Yellow
Write-Host ""

# --- 1. PREREQUISITOS ---
Write-Host "[1/6] Verificando pre-requisitos..." -ForegroundColor Cyan
& node.exe -v | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO: Node.js nao encontrado!" -ForegroundColor Red; Read-Host; exit 1 }
Write-Host "  Node.js OK" -ForegroundColor Green

& docker.exe info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO: Docker nao esta rodando!" -ForegroundColor Red; Read-Host; exit 1 }
Write-Host "  Docker OK" -ForegroundColor Green

# --- 2. POSTGRESQL ---
Write-Host ""
Write-Host "[2/6] PostgreSQL na porta 5434..." -ForegroundColor Cyan

# Remover container antigo (qualquer config)
& docker.exe rm -f cbt-postgres 2>&1 | Out-Null

# Subir novo
Set-Location $ROOT
& docker.exe compose up -d postgres 2>&1 | Out-Null

# Esperar
$ok = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep 1
    & docker.exe exec cbt-postgres pg_isready -U postgres 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Write-Host "  Aguardando... ($i/30)" -ForegroundColor Gray
}
if (-not $ok) { Write-Host "ERRO: PostgreSQL nao subiu!" -ForegroundColor Red; Read-Host; exit 1 }
Write-Host "  PostgreSQL PRONTO" -ForegroundColor Green

# --- 3. BACKEND DEPS ---
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

# Verificar se node_modules existe e tem prisma
$hasPrisma = Test-Path "$ROOT\backend\node_modules\prisma\build\index.js"
if (-not $hasPrisma) {
    Write-Host "  Instalando dependencias..." -ForegroundColor Yellow
    & cmd.exe /c "cd /d `"$ROOT\backend`" && npm install --ignore-scripts && npx prisma generate"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: npm install falhou!" -ForegroundColor Red
        Read-Host; exit 1
    }
}
else {
    Write-Host "  Dependencias OK" -ForegroundColor Green
}

# Fallback: exportar variaveis do .env para o processo atual
# (garante que Prisma as veja mesmo se o auto-load do .env falhar)
Get-Content "$ROOT\backend\.env" | ForEach-Object {
    if ($_ -match "^\s*([^#=\s]+)\s*=\s*(.*)$") {
        $name = $matches[1]
        $value = $matches[2].Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Prisma db push via cmd.exe (mais confiavel no Windows)
Write-Host "  Aplicando schema no banco..." -ForegroundColor Gray
& cmd.exe /c "cd /d `"$ROOT\backend`" && npx prisma db push --accept-data-loss"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha ao aplicar schema!" -ForegroundColor Red
    Read-Host; exit 1
}
Write-Host "  Schema OK" -ForegroundColor Green

Write-Host "  Executando seed completo (base + demo + noticias/eventos + financeiro)..." -ForegroundColor Gray
Write-Host "  (idempotente - pula o que ja foi populado)" -ForegroundColor DarkGray
& cmd.exe /c "cd /d `"$ROOT\backend`" && npm run db:seed:all"
Write-Host "  Seed OK" -ForegroundColor Green

# --- 4. FRONTEND DEPS ---
Write-Host ""
Write-Host "[4/6] Frontend..." -ForegroundColor Cyan

Set-Location "$ROOT\frontend"

# Garantir que frontend\.env existe
if (-not (Test-Path "$ROOT\frontend\.env")) {
    Write-Host "  Criando frontend\.env..." -ForegroundColor Yellow
    [System.IO.File]::WriteAllText("$ROOT\frontend\.env", "VITE_API_URL=http://localhost:3002`n", [System.Text.UTF8Encoding]::new($false))
    Write-Host "  frontend\.env criado" -ForegroundColor Green
}

$hasVite = Test-Path "$ROOT\frontend\node_modules\vite\bin\vite.js"
if (-not $hasVite) {
    Write-Host "  Instalando dependencias..." -ForegroundColor Yellow
    & cmd.exe /c "cd /d `"$ROOT\frontend`" && npm install"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: npm install frontend falhou!" -ForegroundColor Red
        Read-Host; exit 1
    }
}
else {
    Write-Host "  Dependencias OK" -ForegroundColor Green
}

# --- 5. INICIAR BACKEND ---
Write-Host ""
Write-Host "[5/6] Iniciando Backend (porta 3002)..." -ForegroundColor Cyan

Start-Process cmd.exe -ArgumentList "/k title CBT-Backend && color 0E && cd /d `"$ROOT\backend`" && npm run dev"
Write-Host "  Backend iniciando em janela amarela..." -ForegroundColor Green

# Esperar backend responder
$beOk = $false
for ($i = 1; $i -le 25; $i++) {
    Start-Sleep 2
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3002/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $beOk = $true; break }
    } catch {}
    Write-Host "  Aguardando backend... ($i/25)" -ForegroundColor Gray
}
if ($beOk) { Write-Host "  Backend PRONTO" -ForegroundColor Green }
else { Write-Host "  Backend demorou - verifique janela amarela" -ForegroundColor Yellow }

# --- 6. INICIAR FRONTEND ---
Write-Host ""
Write-Host "[6/6] Iniciando Frontend (porta 5173)..." -ForegroundColor Cyan

Start-Process cmd.exe -ArgumentList "/k title CBT-Frontend && color 0B && cd /d `"$ROOT\frontend`" && npx vite --port 5173 --host"
Write-Host "  Frontend iniciando em janela azul..." -ForegroundColor Green

Start-Sleep 5

# --- PRONTO ---
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

Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Write-Host "Encerrado. Para parar PostgreSQL: docker compose down" -ForegroundColor Gray
Read-Host "Enter para fechar"
