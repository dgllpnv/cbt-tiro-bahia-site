# =====================================================
# CBT - Clube Baiano de Tiro - Dev Local
#
# Script defensivo para subir o ambiente em qualquer maquina Windows:
#   - Cria .env (backend/frontend) se faltarem
#   - Detecta node_modules contaminado (binarios de outro SO) e reinstala
#   - Instala dependencias quando ausentes (npm ci com fallback npm install)
#   - Sobe PostgreSQL (Docker), aplica schema Prisma sem dropar dados
#   - Inicia backend (3002) e frontend (5173) em janelas separadas
#   - Mata zumbis nas portas antes de reabrir
#
# NUNCA roda seeds automaticamente - preserva dados locais.
# NUNCA derruba producao - o site hospedado nao usa esses scripts.
# =====================================================

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "CBT - Dev Local"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND  = Join-Path $ROOT "backend"
$FRONTEND = Join-Path $ROOT "frontend"

# Diretorio temporario para logs deste run
$LOG_DIR = Join-Path $env:TEMP "cbt-dev-logs"
if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null }
$RUN_ID  = Get-Date -Format "yyyyMMdd-HHmmss"

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
    $esbuild      = Test-Path (Join-Path $BackendPath "node_modules\@esbuild\win32-x64\esbuild.exe")
    $prismaClient = Test-Path (Join-Path $BackendPath "node_modules\@prisma\client\index.js")
    $tsx          = Test-Path (Join-Path $BackendPath "node_modules\tsx\dist\cli.mjs")
    return ($esbuild -and $prismaClient -and $tsx)
}

function Test-FrontendBinariesOk {
    param([string]$FrontendPath)
    $rollup = Test-Path (Join-Path $FrontendPath "node_modules\@rollup\rollup-win32-x64-msvc")
    $vite   = Test-Path (Join-Path $FrontendPath "node_modules\vite\bin\vite.js")
    return ($rollup -and $vite)
}

# Remove node_modules de forma robusta. Em Windows, Remove-Item pode falhar
# com paths longos ou arquivos travados - fallback para `rd /s /q` que
# costuma resolver casos restantes.
function Remove-NodeModulesSafe {
    param([string]$Path)
    $nm = Join-Path $Path "node_modules"
    if (-not (Test-Path $nm)) { return $true }

    try {
        Remove-Item -Recurse -Force -LiteralPath $nm -ErrorAction Stop
        return $true
    } catch {
        Write-Host "  Remove-Item falhou, tentando rd /s /q..." -ForegroundColor Yellow
    }

    # cmd /c rd /s /q lida melhor com long paths em algumas situacoes
    & cmd.exe /c "rd /s /q `"$nm`""
    if (Test-Path $nm) {
        Write-Host "  AVISO: $nm nao foi totalmente removido - verifique antivirus/processos." -ForegroundColor Yellow
        return $false
    }
    return $true
}

# Roda npm.cmd diretamente (sem wrapper cmd /c) para evitar bugs de aspas
# em paths com espacos. Tenta npm ci (rapido, usa package-lock); se falhar,
# cai para npm install (resolve dependencias do package.json).
function Invoke-NpmInstall {
    param(
        [string]$Path,
        [string]$Label
    )
    $log = Join-Path $LOG_DIR "$Label-$RUN_ID.log"
    Push-Location -LiteralPath $Path
    try {
        $hasLock = Test-Path (Join-Path $Path "package-lock.json")
        $code = 1

        if ($hasLock) {
            Write-Host "  [$Label] Rodando npm ci..." -ForegroundColor Gray
            & npm.cmd ci --no-audit --no-fund *> $log
            $code = $LASTEXITCODE
            Get-Content $log | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }

        if ($code -ne 0) {
            if ($hasLock) {
                Write-Host "  [$Label] npm ci falhou (exit $code). Tentando npm install..." -ForegroundColor Yellow
            } else {
                Write-Host "  [$Label] Sem package-lock - rodando npm install..." -ForegroundColor Gray
            }
            & npm.cmd install --no-audit --no-fund *> $log
            $code = $LASTEXITCODE
            Get-Content $log | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }

        if ($code -ne 0) {
            Write-Host ""
            Write-Host "  [$Label] FALHA no npm install (exit $code)." -ForegroundColor Red
            Write-Host "  Log salvo em: $log" -ForegroundColor Yellow
            Write-Host "  Diagnostico comum:" -ForegroundColor Yellow
            Write-Host "    - Sem internet ou proxy bloqueando registry.npmjs.org" -ForegroundColor DarkGray
            Write-Host "    - Antivirus bloqueando node_modules (Windows Defender e o mais comum)" -ForegroundColor DarkGray
            Write-Host "    - Cache npm corrompido: rode `"npm cache clean --force`"" -ForegroundColor DarkGray
        }
        return $code
    } finally {
        Pop-Location
    }
}

function Reset-NodeModules {
    param([string]$Path, [string]$Label)
    Write-Host "  [$Label] node_modules contaminado ou incompleto - reinstalando..." -ForegroundColor Yellow
    Remove-NodeModulesSafe -Path $Path | Out-Null
    return (Invoke-NpmInstall -Path $Path -Label $Label)
}

# ---------- HEADER ----------

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  CBT - Clube Baiano de Tiro" -ForegroundColor White
Write-Host "  Setup de Desenvolvimento Local" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL:5434  Backend:3002  Frontend:5173" -ForegroundColor Yellow
Write-Host "  Logs deste run: $LOG_DIR" -ForegroundColor DarkGray
Write-Host ""

# ---------- 1. PREREQUISITOS ----------

Write-Host "[1/6] Verificando pre-requisitos..." -ForegroundColor Cyan

$nodeVer = & node.exe -v 2>$null
if ($LASTEXITCODE -ne 0 -or -not $nodeVer) {
    Write-Host "ERRO: Node.js nao encontrado no PATH!" -ForegroundColor Red
    Write-Host "  Instale em https://nodejs.org (recomendado: v22 LTS)" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host "  Node.js $nodeVer" -ForegroundColor Green

$npmVer = & npm.cmd -v 2>$null
if ($LASTEXITCODE -ne 0 -or -not $npmVer) {
    Write-Host "ERRO: npm nao encontrado!" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host "  npm v$npmVer" -ForegroundColor Green

& docker.exe info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Docker Desktop nao esta rodando!" -ForegroundColor Red
    Write-Host "  Abra o Docker Desktop e aguarde ficar healthy (1-2 min)" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host "  Docker OK" -ForegroundColor Green

# ---------- 1.5. ARQUIVOS .env ----------
#
# Garante que backend\.env e frontend\.env existem (sao gitignored).
# Sem isso, Prisma falha com P1012 e o frontend nao acha a API.
# Idempotente: nao sobrescreve nem altera valores existentes.

Write-Host ""
Write-Host "[1.5/6] Arquivos .env..." -ForegroundColor Cyan

$backendEnv = Join-Path $BACKEND ".env"
if (-not (Test-Path $backendEnv)) {
    Write-Host "  Criando backend\.env..." -ForegroundColor Yellow
    # JWT_SECRET aleatorio de 128 hex chars (64 bytes). Para producao,
    # substitua manualmente ou regenere com:
    #   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
    $jwtSecret = -join ((1..128) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
    $envContent = @"
# Banco de dados (corresponde ao docker-compose.yml na raiz)
DATABASE_URL=postgresql://postgres:cbt_dev_2024@localhost:5434/cbt_portal
DIRECT_URL=postgresql://postgres:cbt_dev_2024@localhost:5434/cbt_portal

# Autenticacao
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d

# Servidor
PORT=3002
NODE_ENV=development

# CORS - localhost por default; *.easypanel.host eh aceito automaticamente
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173,http://localhost:5174,http://localhost:3000

# Cloudinary (opcional - para uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
"@
    [System.IO.File]::WriteAllText($backendEnv, $envContent, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  backend\.env criado" -ForegroundColor Green
} else {
    Write-Host "  backend\.env ja existe (preservado)" -ForegroundColor DarkGray
}

$frontendEnv = Join-Path $FRONTEND ".env"
if (-not (Test-Path $frontendEnv)) {
    Write-Host "  Criando frontend\.env..." -ForegroundColor Yellow
    [System.IO.File]::WriteAllText($frontendEnv, "VITE_API_URL=http://localhost:3002`n", [System.Text.UTF8Encoding]::new($false))
    Write-Host "  frontend\.env criado" -ForegroundColor Green
} else {
    Write-Host "  frontend\.env ja existe (preservado)" -ForegroundColor DarkGray
}

# Carrega o backend\.env no processo atual para os comandos prisma desta sessao
Get-Content $backendEnv | ForEach-Object {
    if ($_ -match "^\s*([^#=\s]+)\s*=\s*(.*)$") {
        $name  = $matches[1]
        $value = $matches[2].Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# ---------- 2. POSTGRESQL ----------

Write-Host ""
Write-Host "[2/6] PostgreSQL na porta 5434..." -ForegroundColor Cyan

$pgRunning = $false
$status = & docker.exe inspect -f "{{.State.Running}}" cbt-postgres 2>$null
if ($status -eq "true") {
    Write-Host "  Container cbt-postgres ja esta rodando - reusando" -ForegroundColor Gray
    $pgRunning = $true
} else {
    Push-Location -LiteralPath $ROOT
    & docker.exe compose up -d postgres 2>&1 | Out-Null
    Pop-Location
}

$ok = $pgRunning
if (-not $ok) {
    for ($i = 1; $i -le 30; $i++) {
        Start-Sleep 1
        & docker.exe exec cbt-postgres pg_isready -U postgres 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
        Write-Host "  Aguardando... ($i/30)" -ForegroundColor Gray
    }
}
if (-not $ok) {
    Write-Host "ERRO: PostgreSQL nao subiu!" -ForegroundColor Red
    Write-Host "  Verifique com: docker logs cbt-postgres" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host "  PostgreSQL PRONTO" -ForegroundColor Green

# ---------- 3. BACKEND DEPS ----------

Write-Host ""
Write-Host "[3/6] Backend..." -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $BACKEND "node_modules"))) {
    Write-Host "  node_modules ausente - instalacao inicial..." -ForegroundColor Yellow
    $rc = Invoke-NpmInstall -Path $BACKEND -Label "Backend"
    if ($rc -ne 0) {
        Write-Host "ERRO: npm install backend falhou (veja log acima)" -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
    Write-Host "  Dependencias instaladas" -ForegroundColor Green
} elseif (-not (Test-BackendBinariesOk $BACKEND)) {
    $rc = Reset-NodeModules $BACKEND "Backend"
    if ($rc -ne 0) {
        Write-Host "ERRO: npm install backend falhou (veja log acima)" -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
    Write-Host "  Backend reinstalado com binarios Windows" -ForegroundColor Green
} else {
    Write-Host "  Dependencias OK (binarios Windows presentes)" -ForegroundColor Green
}

# Prisma db push - idempotente, NAO apaga dados existentes
Write-Host "  Aplicando schema no banco (sem alterar dados)..." -ForegroundColor Gray
Push-Location -LiteralPath $BACKEND
& npx.cmd prisma db push
$pushCode = $LASTEXITCODE
Pop-Location
if ($pushCode -ne 0) {
    Write-Host "ERRO: Falha ao aplicar schema!" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host "  Schema OK" -ForegroundColor Green

Write-Host "  Seed DESATIVADO - banco preservado." -ForegroundColor Yellow
Write-Host "  Para popular do zero: cd backend && npm run db:seed:all" -ForegroundColor DarkGray

# ---------- 4. FRONTEND DEPS ----------

Write-Host ""
Write-Host "[4/6] Frontend..." -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $FRONTEND "node_modules"))) {
    Write-Host "  node_modules ausente - instalacao inicial..." -ForegroundColor Yellow
    $rc = Invoke-NpmInstall -Path $FRONTEND -Label "Frontend"
    if ($rc -ne 0) {
        Write-Host "ERRO: npm install frontend falhou (veja log acima)" -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
    Write-Host "  Dependencias instaladas" -ForegroundColor Green
} elseif (-not (Test-FrontendBinariesOk $FRONTEND)) {
    $rc = Reset-NodeModules $FRONTEND "Frontend"
    if ($rc -ne 0) {
        Write-Host "ERRO: npm install frontend falhou (veja log acima)" -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
    Write-Host "  Frontend reinstalado com binarios Windows" -ForegroundColor Green
} else {
    Write-Host "  Dependencias OK (binarios Windows presentes)" -ForegroundColor Green
}

# ---------- 5. INICIAR BACKEND ----------

Write-Host ""
Write-Host "[5/6] Iniciando Backend (porta 3002)..." -ForegroundColor Cyan

Stop-PortProcess -Port 3002

Start-Process cmd.exe -ArgumentList "/k title CBT-Backend && color 0E && cd /d `"$BACKEND`" && npm run dev"
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

Start-Process cmd.exe -ArgumentList "/k title CBT-Frontend && color 0B && cd /d `"$FRONTEND`" && npx vite --port 5173 --host"
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

Write-Host "Pressione Enter para ENCERRAR backend e frontend..." -ForegroundColor Red
Read-Host

Stop-PortProcess -Port 3002
Stop-PortProcess -Port 5173

Write-Host "Encerrado. Para parar PostgreSQL: docker compose down" -ForegroundColor Gray
Read-Host "Enter para fechar"
