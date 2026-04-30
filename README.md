# CBT — Clube Baiano de Tiro · Portal de Gestão

Sistema de gestão completo para clube de tiro: associados, presença, lançamentos, estoque, financeiro, notícias, eventos e rankings — com painel admin e portal do associado.

> Stack: **React + Vite + TypeScript** (frontend), **Node + Express + Prisma** (backend), **PostgreSQL 16** (Docker).

---

## ⚡ Quick start (5 min)

### 1. Pré-requisitos

| Ferramenta | Versão | Como instalar |
|---|---|---|
| **Node.js** | ≥ 22.x | https://nodejs.org (recomendado: instalar via [nvm](https://github.com/nvm-sh/nvm) ou [nvm-windows](https://github.com/coreybutler/nvm-windows)) |
| **npm** | ≥ 10.x | já vem com Node |
| **Docker Desktop** | última | https://www.docker.com/products/docker-desktop · **deve estar rodando antes do start** |
| **Git** | ≥ 2.30 | https://git-scm.com |

> ⚠️ **Antes de tudo: abra o Docker Desktop** e espere até a baleinha ficar verde. Sem isso o PostgreSQL não sobe.

### 2. Clonar e rodar

#### Windows
```bat
git clone https://github.com/dgllpnv/cbt-tiro-bahia-site.git
cd cbt-tiro-bahia-site
git checkout branch-enzo
start-dev.bat
```

#### macOS / Linux
```bash
git clone https://github.com/dgllpnv/cbt-tiro-bahia-site.git
cd cbt-tiro-bahia-site
git checkout branch-enzo
chmod +x start-dev.sh
./start-dev.sh
```

O script faz **tudo automaticamente** na primeira execução (~2-3 min):

1. ✓ Verifica Node, npm, Docker
2. ✓ Sobe PostgreSQL via Docker (porta `5434`)
3. ✓ Cria `backend/.env` e `frontend/.env` se não existirem
4. ✓ Roda `npm install` no back e front (só na 1ª vez)
5. ✓ Aplica schema Prisma (`prisma db push`)
6. ✓ **Popula o banco completo** com dados de demonstração (sócios, visitas, tiros, notícias, eventos, transações, despesas)
7. ✓ Inicia backend (`http://localhost:3002`) em janela amarela
8. ✓ Inicia frontend (`http://localhost:5173`) em janela azul
9. ✓ Abre o navegador

Da segunda vez em diante, o setup pula tudo que já está pronto e sobe em ~10 segundos.

### 3. URLs e credenciais

| | URL |
|---|---|
| **Site** | http://localhost:5173 |
| **Login** | http://localhost:5173/login |
| **API health** | http://localhost:3002/health |
| **Prisma Studio (UI do banco)** | `cd backend && npm run db:studio` |

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | `admin@cbt.com.br` | `admin123` |
| Associado teste | `associado@cbt.com.br` | `associado123` |
| Sócios demo (CBT0101–CBT0120) | `cbt0101@demo.cbt.com.br` (até 0120) | `demo123` |

---

## 📦 O que é populado (dados de demonstração)

Após `start-dev`, o banco vem com:

- **22 sócios ativos** (admin + associado teste + 20 demo) com tempo de casa variado (recém-cadastrados a 7 anos)
- **42 produtos no estoque**: munições CBC/Magtech (9mm, .380, .40, .45, .357, .38 SPL, .22 LR, .223, .308, 12 GA), alvos, EPIs, acessórios, cursos
- **6 baias de tiro** configuradas
- **~300 visitas** distribuídas nos últimos 90 dias com peso por dia da semana (sábado domina)
- **~760 detalhes de tiro** com armas reais (Glock 17, Taurus G2c, CZ Shadow 2, IMBEL IA2, Sig P320, etc.) e calibres realistas
- **3 sócios "presentes agora"** sem checkout (para a demo do painel front-desk)
- **12 notícias** cobrindo regulamentação CAC, lançamentos, competições, jurisprudência STF/STJ, manutenção interna
- **15 eventos** próximos 3-6 meses (competições IPSC, Steel Challenge, cursos Habitualidade/Black Badge, palestras, confraternização junina, viagem ao Brasileiro)
- **260 transações de venda** (~R$ 154 mil em 90d) com receita realista de R$ 40-50k/mês
- **49 despesas** (folha, aluguel, energia Coelba, internet, manutenção, compras CBC, marketing)
- **13 anuidades pagas** (R$ 600 cada)

> Os 4 seeds são **idempotentes** — rodar de novo não duplica nada.

---

## 🛠️ Comandos úteis

```bash
# Backend
cd backend
npm run dev              # tsx watch (porta 3002)
npm run db:studio        # Prisma Studio em http://localhost:5555
npm run db:push          # aplicar mudanças do schema
npm run db:seed          # apenas seed base (admin + lanes + 5 produtos)
npm run db:seed:demo     # 20 sócios + visitas + tiros
npm run db:seed:news-events
npm run db:seed:financial
npm run db:seed:all      # todos em ordem (idempotente)
npm run db:reset         # APAGA banco e roda seed:all (cuidado!)

# Frontend
cd frontend
npm run dev              # vite dev server (porta 5173)
npm run build            # build de produção
npm run lint             # eslint

# Docker
docker compose up -d postgres   # subir só o banco
docker compose down             # parar (mantém dados)
docker compose down -v          # parar e APAGAR volume (dados perdidos)
docker logs cbt-postgres -f     # acompanhar logs do Postgres
```

---

## 🐛 Troubleshooting

### "Docker daemon não está rodando"
Abra o **Docker Desktop** e aguarde a baleinha ficar verde. Em Windows, pode demorar 1-2 min após login.

### "Porta 5434 / 3002 / 5173 já está em uso"
Verifique se outro projeto está nessas portas. Para limpar:
```bash
# Windows
netstat -ano | findstr :3002    # ver PID
taskkill /PID <PID> /F          # matar

# macOS/Linux
lsof -i :3002
kill -9 <PID>
```

### "Erro Prisma P1012" / EPERM no Windows
O backend está rodando e travou o `query_engine.dll`. Pare o backend (feche a janela amarela) e rode:
```bash
cd backend && npm run db:push
```

### Banco corrompido / quero começar do zero
```bash
docker compose down -v          # apaga volume
docker compose up -d postgres   # recria limpo
cd backend && npm run db:reset  # schema + seed completo
```

### Página não carrega / "Network error" no front
1. Confira se o backend está respondendo: http://localhost:3002/health → deve retornar JSON `{"success":true,...}`
2. Confira `frontend/.env` → `VITE_API_URL=http://localhost:3002`
3. Reinicie o frontend (Ctrl+C na janela azul + rode `npm run dev` no `frontend/`)

### Permissões no PowerShell (Windows)
Se aparecer "execução de scripts desabilitada", o `start-dev.bat` já passa `-ExecutionPolicy Bypass`. Caso ainda falhe:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📁 Estrutura

```
cbt-tiro-bahia-site/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # modelo de dados
│   │   ├── seed.ts                  # base
│   │   ├── seed-demo.ts             # sócios + visitas + tiros
│   │   ├── seed-news-events.ts      # notícias + eventos
│   │   └── seed-financial.ts        # transações + despesas
│   ├── src/
│   │   ├── routes/                  # express routers (REST)
│   │   ├── lib/                     # firearmsCatalog, prisma client
│   │   ├── middleware/              # auth, etc
│   │   ├── services/                # auditService, etc
│   │   └── index.ts                 # bootstrap
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/admin/             # Dashboard, Associados, Estoque, Financeiro, etc
│   │   ├── pages/portal/            # área do associado
│   │   ├── components/              # admin/, shared/, ui/ (shadcn)
│   │   ├── services/                # axios wrappers para a API
│   │   └── lib/                     # firearmsCatalog, iconRegistry, formatters
│   ├── package.json
│   └── .env.example
├── docker-compose.yml               # PostgreSQL
├── start-dev.bat                    # entry-point Windows
├── start-dev.ps1                    # script real Windows
├── start-dev.sh                     # entry-point macOS/Linux
└── README.md
```

---

## 🚀 Stack

**Backend**
- Node 22 + TypeScript + tsx watch
- Express + Zod (validação)
- Prisma 5 + PostgreSQL 16
- JWT + bcryptjs (auth)

**Frontend**
- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui (Radix)
- React Router, React Query, Axios
- Recharts, lucide-react, react-icons (Game Icons)
- date-fns

**Infra**
- Docker (PostgreSQL local)

---

## 🔐 Notas de segurança

- O `.env` do backend contém `JWT_SECRET` — **nunca** commite. Já está no `.gitignore`.
- Os valores em `.env.example` são **apenas para DEV**. Em produção:
  - Gere `JWT_SECRET` aleatório: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
  - Troque a senha do PostgreSQL no `docker-compose.yml`
  - Restrinja `ALLOWED_ORIGINS` ao domínio público do frontend
  - Use HTTPS sempre

---

## 📝 Licença

Projeto interno CBT — uso restrito.
