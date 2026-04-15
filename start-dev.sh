#!/bin/bash
# =====================================================
# CBT - CLUBE BAIANO DE TIRO
# Script de Desenvolvimento Local
# =====================================================
# Portas utilizadas:
#   PostgreSQL: 5434
#   Backend:    3002
#   Frontend:   5173
# =====================================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

print_header() {
  echo ""
  echo -e "${CYAN}=========================================${NC}"
  echo -e "${BOLD}  CBT - Clube Baiano de Tiro${NC}"
  echo -e "${BOLD}  Setup de Desenvolvimento Local${NC}"
  echo -e "${CYAN}=========================================${NC}"
  echo ""
}

print_step() {
  echo -e "${BLUE}[STEP]${NC} $1"
}

print_ok() {
  echo -e "${GREEN}  [OK]${NC} $1"
}

print_warn() {
  echo -e "${YELLOW}  [!!]${NC} $1"
}

print_error() {
  echo -e "${RED}  [ERRO]${NC} $1"
}

print_info() {
  echo -e "${CYAN}  [i]${NC} $1"
}

cleanup() {
  echo ""
  echo -e "${YELLOW}Encerrando servicos...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}Servicos encerrados. PostgreSQL continua rodando no Docker.${NC}"
  echo -e "${CYAN}Para parar o banco: docker compose down${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# =====================================================
# 0. VERIFICAR PREREQUISITOS
# =====================================================
print_header

print_step "Verificando pre-requisitos..."

# Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v)
  print_ok "Node.js $NODE_VERSION"
else
  print_error "Node.js nao encontrado! Instale em https://nodejs.org"
  exit 1
fi

# npm
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm -v)
  print_ok "npm v$NPM_VERSION"
else
  print_error "npm nao encontrado!"
  exit 1
fi

# Docker
if command -v docker &> /dev/null; then
  DOCKER_VERSION=$(docker --version 2>/dev/null | head -1)
  print_ok "$DOCKER_VERSION"
else
  print_error "Docker nao encontrado! Instale Docker Desktop."
  exit 1
fi

# Docker Compose
if docker compose version &> /dev/null; then
  COMPOSE_VERSION=$(docker compose version 2>/dev/null | head -1)
  print_ok "$COMPOSE_VERSION"
elif command -v docker-compose &> /dev/null; then
  print_ok "docker-compose (legacy)"
  COMPOSE_CMD="docker-compose"
else
  print_error "Docker Compose nao encontrado!"
  exit 1
fi

COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

# Verificar se Docker daemon esta rodando
if ! docker info &> /dev/null 2>&1; then
  print_error "Docker daemon nao esta rodando! Inicie o Docker Desktop."
  exit 1
fi
print_ok "Docker daemon ativo"

# Verificar portas livres
check_port() {
  if command -v ss &> /dev/null; then
    ss -tlnp 2>/dev/null | grep -q ":$1 " && return 1 || return 0
  elif command -v netstat &> /dev/null; then
    netstat -tlnp 2>/dev/null | grep -q ":$1 " && return 1 || return 0
  else
    return 0
  fi
}

PORTS_OK=true
for PORT in 5434 3002 5173; do
  if check_port $PORT; then
    print_ok "Porta $PORT disponivel"
  else
    print_warn "Porta $PORT pode estar em uso (verificar)"
    PORTS_OK=false
  fi
done

echo ""

# =====================================================
# 1. SUBIR POSTGRESQL VIA DOCKER
# =====================================================
print_step "Iniciando PostgreSQL via Docker..."

cd "$ROOT_DIR"

# Verificar se container ja existe e esta rodando
if docker ps --format '{{.Names}}' | grep -q "cbt-postgres"; then
  print_ok "PostgreSQL ja esta rodando (container cbt-postgres)"
else
  # Verificar se container existe mas parado
  if docker ps -a --format '{{.Names}}' | grep -q "cbt-postgres"; then
    print_info "Iniciando container existente..."
    docker start cbt-postgres > /dev/null 2>&1
  else
    print_info "Criando container PostgreSQL..."
    $COMPOSE_CMD up -d postgres 2>&1 | tail -3
  fi

  # Aguardar PostgreSQL ficar pronto
  print_info "Aguardando PostgreSQL ficar pronto..."
  RETRIES=0
  MAX_RETRIES=30
  until docker exec cbt-postgres pg_isready -U postgres > /dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
      print_error "PostgreSQL nao ficou pronto em tempo! Verifique os logs:"
      echo "  docker logs cbt-postgres"
      exit 1
    fi
    sleep 1
  done
  print_ok "PostgreSQL pronto na porta 5434"
fi

echo ""

# =====================================================
# 2. INSTALAR DEPENDENCIAS DO BACKEND
# =====================================================
print_step "Configurando Backend..."

cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
  print_info "Instalando dependencias do backend..."
  npm install 2>&1 | tail -3
  print_ok "Dependencias do backend instaladas"
else
  print_ok "Dependencias do backend ja existem"
fi

# Gerar Prisma Client
print_info "Gerando Prisma Client..."
npx prisma generate 2>&1 | tail -2
print_ok "Prisma Client gerado"

# Rodar migrations
print_info "Aplicando schema ao banco de dados..."
npx prisma db push --accept-data-loss 2>&1 | tail -3
print_ok "Schema aplicado"

# Seed
print_info "Populando dados iniciais (seed)..."
npm run db:seed 2>&1 | tail -5
print_ok "Seed executado"

echo ""

# =====================================================
# 3. INSTALAR DEPENDENCIAS DO FRONTEND
# =====================================================
print_step "Configurando Frontend..."

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  print_info "Instalando dependencias do frontend..."
  npm install 2>&1 | tail -3
  print_ok "Dependencias do frontend instaladas"
else
  print_ok "Dependencias do frontend ja existem"
fi

echo ""

# =====================================================
# 4. INICIAR BACKEND
# =====================================================
print_step "Iniciando Backend na porta 3002..."

cd "$BACKEND_DIR"
npm run dev > "$ROOT_DIR/.backend.log" 2>&1 &
BACKEND_PID=$!
print_info "Backend PID: $BACKEND_PID"

# Aguardar backend subir
sleep 3
RETRIES=0
MAX_RETRIES=20
until curl -s http://localhost:3002/health > /dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    print_error "Backend nao subiu! Verifique o log:"
    echo ""
    cat "$ROOT_DIR/.backend.log" | tail -20
    exit 1
  fi
  sleep 1
done
print_ok "Backend rodando em http://localhost:3002"

# Testar health
HEALTH=$(curl -s http://localhost:3002/health)
print_ok "Health check: $HEALTH"

echo ""

# =====================================================
# 5. INICIAR FRONTEND
# =====================================================
print_step "Iniciando Frontend na porta 5173..."

cd "$FRONTEND_DIR"
npx vite --port 5173 --host > "$ROOT_DIR/.frontend.log" 2>&1 &
FRONTEND_PID=$!
print_info "Frontend PID: $FRONTEND_PID"

# Aguardar frontend subir
sleep 4
RETRIES=0
MAX_RETRIES=15
until curl -s http://localhost:5173 > /dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    print_warn "Frontend pode demorar um pouco mais para subir..."
    break
  fi
  sleep 1
done
print_ok "Frontend rodando em http://localhost:5173"

echo ""

# =====================================================
# PRONTO!
# =====================================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${GREEN}${BOLD}  TUDO PRONTO!${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""
echo -e "  ${BOLD}Site:${NC}       http://localhost:5173"
echo -e "  ${BOLD}Portal:${NC}     http://localhost:5173/login"
echo -e "  ${BOLD}API:${NC}        http://localhost:3002"
echo -e "  ${BOLD}Health:${NC}     http://localhost:3002/health"
echo -e "  ${BOLD}DB Studio:${NC}  cd backend && npx prisma studio"
echo ""
echo -e "  ${BOLD}Credenciais de teste:${NC}"
echo -e "  ${YELLOW}Admin:${NC}      admin@cbt.com.br / admin123"
echo -e "  ${YELLOW}Associado:${NC}  associado@cbt.com.br / associado123"
echo ""
echo -e "${CYAN}=========================================${NC}"
echo -e "  ${BOLD}Logs em tempo real:${NC}"
echo -e "  Backend:  tail -f .backend.log"
echo -e "  Frontend: tail -f .frontend.log"
echo -e "  Postgres: docker logs -f cbt-postgres"
echo ""
echo -e "  ${RED}Pressione Ctrl+C para encerrar${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Mostrar logs combinados
tail -f "$ROOT_DIR/.backend.log" "$ROOT_DIR/.frontend.log" 2>/dev/null
