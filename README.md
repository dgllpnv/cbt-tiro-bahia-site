# Portal CBT — Clube Baiano de Tiro

Sistema de gestão para clube de tiro esportivo: cadastro de associados, controle de presença e disparos por baia, lançamentos financeiros, estoque de munições e EPIs, anuidades, eventos/competições, habitualidade (CR/CAC) e auditoria de operações.

O sistema serve dois públicos numa única SPA:

- **Portal Admin** (`/admin/*`) — operação de balcão, gestão de associados, financeiro, estoque e conteúdo.
- **Portal do Associado** (`/portal/*`) — área pessoal: histórico de treinos, anuidade, carteirinha digital, habitualidade, eventos e documentos.

---

## Sumário

1. [Arquitetura](#arquitetura)
2. [Stack](#stack)
3. [Setup local](#setup-local)
4. [Credenciais de demonstração](#credenciais-de-demonstração)
5. [Scripts npm](#scripts-npm)
6. [Estrutura de diretórios](#estrutura-de-diretórios)
7. [Convenções de API](#convenções-de-api)
8. [Auditoria](#auditoria)
9. [Banco de dados](#banco-de-dados)
10. [Build e deploy](#build-e-deploy)
11. [Troubleshooting](#troubleshooting)
12. [Licença](#licença)

---

## Arquitetura

```mermaid
flowchart LR
    Browser["Browser (SPA)"] -- HTTP/JSON --> API["Express + Prisma"]
    API -- SQL --> DB[("PostgreSQL 16")]
    API -- registra --> Audit[(AuditLog)]
    Audit --- DB
    Browser -- JWT Bearer --> API
```

**Camadas:**

| Camada | Onde | Responsabilidade |
|---|---|---|
| UI | `frontend/src/pages/{admin,portal}` | Páginas de cada portal |
| Componentes de domínio | `frontend/src/components/{admin,shared,layout,members}` | Cards de presença, busca de associados, IconPicker, etc. |
| UI primitives | `frontend/src/components/ui` | shadcn/ui (Radix) — Button, Dialog, Tabs, Select, Toast |
| Serviços HTTP | `frontend/src/services/*.ts` | 1 service por router do backend, axios via `services/api.ts` |
| Auth client | `frontend/src/contexts/AuthContext.tsx` | Restauro síncrono do user em `localStorage`, validação em background com `/api/auth/me` |
| API REST | `backend/src/routes/*.ts` | 19 routers Express com validação Zod |
| Middleware | `backend/src/middleware/authMiddleware.ts` | Verificação de JWT + `requireRole(...)` |
| Audit | `backend/src/services/auditService.ts` | Cria entradas em `AuditLog` (engole exceções: nunca falha a operação principal) |
| ORM | `backend/prisma/schema.prisma` | Source of truth do schema |
| Banco | PostgreSQL 16 em Docker (porta 5434) | Persistência |

**Fluxos transacionais críticos** (todos em `prisma.$transaction`):

- **Check-in com baia**: valida lane `AVAILABLE`, cria `Visit`, ocupa `Lane` (status + `currentMemberId`).
- **Check-out**: registra `checkOutTime`, libera `Lane`.
- **Venda**: valida estoque, cria `Transaction` + `TransactionItem`, debita `StockItem.currentStock`, registra `StockMovement(SALE_OUT)`.
- **Cancelar venda**: reverte stock (`StockMovement(RETURN_IN)`), apaga transação (cascade nos items).
- **Empréstimo**: marca `Equipment.isAvailable=false` + cria `EquipmentLoan` com `conditionAtLoan`.
- **Anuidade**: empilha sobre validade existente — `validFrom = max(now, atual+1)`, `validUntil = validFrom + 1 ano`, atualiza `User.annuityValidUntil`.

---

## Stack

**Backend** (`backend/`)
- Node 22 + TypeScript 5 (ESM, `"type":"module"` — imports usam extensão `.js` por causa do ESM)
- Express 4
- Prisma 5 + `@prisma/client`
- Zod (validação de payload)
- bcryptjs (hash de senha, salt 10)
- JSON Web Token (JWT, expira em 7d por default)
- date-fns
- Dev: `tsx watch`

**Frontend** (`frontend/`)
- React 18 + Vite 5 + TypeScript 5
- React Router v6
- TanStack Query 5 (instalado, mas a maior parte das páginas usa `useState` + `useEffect` + axios direto)
- Axios (cliente HTTP)
- Tailwind CSS 3 + tailwindcss-animate
- shadcn/ui (Radix UI primitives)
- Recharts (gráficos)
- React Hook Form + Zod
- jsPDF + jsPDF-AutoTable, qrcode.react (carteirinha)
- lucide-react + react-icons (Game Icons para armas)
- date-fns 3
- framer-motion

**Infra**
- PostgreSQL 16 (Alpine) via Docker Compose
- Volume nomeado `cbt_postgres_data`

---

## Setup local

### Pré-requisitos

| Ferramenta | Versão | Como instalar |
|---|---|---|
| Node.js | ≥ 22.x | https://nodejs.org (recomendado: nvm) |
| npm | ≥ 10.x | já vem com Node |
| Docker Desktop | atual | https://www.docker.com/products/docker-desktop |
| Git | ≥ 2.30 | https://git-scm.com |

> **Antes de tudo:** abra o Docker Desktop e aguarde até estar healthy. Sem isso o PostgreSQL não sobe.

### Clonar e rodar (passo a passo)

```bash
git clone https://github.com/dgllpnv/cbt-tiro-bahia-site.git
cd cbt-tiro-bahia-site

# 1) Sobe o PostgreSQL
docker compose up -d postgres

# 2) Backend
cd backend
cp .env.example .env          # ajuste JWT_SECRET em produção
npm install
npm run db:push               # aplica schema (sem migrations)
npm run db:seed:all           # popula admin + 20 sócios + visitas + notícias + financeiro
npm run dev                   # http://localhost:3002

# 3) Frontend (em outro terminal)
cd ../frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

### Atalho one-shot

Para automatizar todo o passo acima na primeira vez (e em re-runs), o repositório inclui scripts de bootstrap que orquestram Docker + install + seed + dev em duas janelas separadas:

```bash
# Windows
start-dev.bat

# macOS / Linux
chmod +x start-dev.sh && ./start-dev.sh
```

### Variáveis de ambiente

**`backend/.env`**

| Variável | Default dev | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:cbt_dev_2024@localhost:5434/cbt_portal` | URL do Postgres |
| `JWT_SECRET` | (template) | **Trocar em prod** — `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` | TTL do token |
| `PORT` | `3002` | Porta do Express |
| `NODE_ENV` | `development` | Habilita request log e mensagens de erro detalhadas |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost:5174` | Lista CSV para CORS |

**`frontend/.env`**

| Variável | Default dev | Descrição |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3002` | URL base da API |

### URLs

| | URL |
|---|---|
| Site público | http://localhost:5173 |
| Login | http://localhost:5173/login |
| Health check da API | http://localhost:3002/health |
| Prisma Studio | `cd backend && npm run db:studio` → http://localhost:5555 |

---

## Credenciais de demonstração

Após `npm run db:seed:all`:

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@cbt.com.br` | `admin123` |
| Associado teste | `associado@cbt.com.br` | `associado123` |
| Sócios demo (CBT0101–CBT0120) | `cbt0101@demo.cbt.com.br` … `cbt0120@demo.cbt.com.br` | `demo123` |

**Os 4 seeds são idempotentes** — rodar `db:seed:all` múltiplas vezes não duplica dados.

---

## Scripts npm

### Backend (`cd backend`)

| Script | Função |
|---|---|
| `npm run dev` | Inicia o servidor em watch mode (`tsx watch src/index.ts`) na porta 3002 |
| `npm run start:prod` | Roda sem watch (uso simples em produção) |
| `npm run build` | `prisma generate` (mantemos `tsx` no runtime de prod) |
| `npm run db:push` | Aplica `schema.prisma` no banco sem criar migration (workflow de dev) |
| `npm run db:generate` | Regenera o Prisma Client |
| `npm run db:studio` | UI web do Prisma em http://localhost:5555 |
| `npm run db:seed` | Seed base: admin + associado + 6 baias + 5 produtos |
| `npm run db:seed:demo` | Adiciona 20 sócios demo + ~300 visitas + ~760 disparos |
| `npm run db:seed:news-events` | Notícias + eventos |
| `npm run db:seed:financial` | Transações + despesas + anuidades |
| `npm run db:seed:all` | Roda os 4 seeds em ordem |
| `npm run db:reset` | **Apaga o banco** (`db push --force-reset`) e roda `db:seed:all` |

### Frontend (`cd frontend`)

| Script | Função |
|---|---|
| `npm run dev` | Vite dev server em http://localhost:5173 |
| `npm run build` | Build de produção em `dist/` |
| `npm run build:dev` | Build em modo `development` (source maps + sem minificação) |
| `npm run preview` | Serve o build estático para inspeção |
| `npm run lint` | ESLint |

### Docker

```bash
docker compose up -d postgres   # subir só o banco
docker compose down             # parar (mantém dados)
docker compose down -v          # parar e APAGAR volume
docker logs cbt-postgres -f     # acompanhar logs
```

---

## Estrutura de diretórios

```
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # Source of truth do banco
│   │   ├── seed.ts                  # Admin + associado teste + 6 baias + 5 produtos
│   │   ├── seed-demo.ts             # 20 sócios + visitas + tiros
│   │   ├── seed-news-events.ts
│   │   └── seed-financial.ts
│   ├── src/
│   │   ├── routes/                  # 19 routers Express (REST)
│   │   ├── middleware/              # authMiddleware (JWT + requireRole)
│   │   ├── services/                # auditService
│   │   ├── lib/                     # firearmsCatalog, prisma client
│   │   └── index.ts                 # Bootstrap, CORS, /health, mount dos routers
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── branding/                # Logos e fotos do clube
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/               # Dashboard, Lançamentos, Associados, Financeiro, Estoque, Logs, Notícias, Eventos, Configurações
│   │   │   └── portal/              # Home, Histórico, Perfil, Anuidade, Carteirinha, Habitualidade, Eventos, Documentos
│   │   ├── components/
│   │   │   ├── admin/               # PresentMembersPanel, RankingsPanel, ShotEntryDialog, IconPicker, MemberProfileTab
│   │   │   ├── auth/                # ProtectedRoute
│   │   │   ├── layout/              # PortalLayout, PortalSidebar, PortalHeader
│   │   │   ├── shared/              # Search inputs, ConfirmDialog, EmptyState, PageHeader
│   │   │   ├── members/             # MemberStatusBadge
│   │   │   └── ui/                  # shadcn/ui primitives
│   │   ├── services/                # 1 arquivo por router do backend
│   │   ├── contexts/AuthContext.tsx
│   │   ├── lib/                     # firearmsCatalog, formatters, constants, iconRegistry, ammunitionVisuals
│   │   ├── hooks/                   # use-toast, use-mobile
│   │   ├── types/                   # user, api
│   │   └── App.tsx                  # Rotas + providers
│   └── package.json
│
├── docker-compose.yml               # PostgreSQL 16
├── start-dev.{bat,ps1,sh}           # Bootstrap one-shot
└── README.md
```

---

## Convenções de API

**Formato de resposta** — todas as rotas devolvem:

```jsonc
// Sucesso
{ "success": true, "data": ..., "pagination": { "page", "limit", "total", "totalPages" } }

// Erro
{ "success": false, "error": "Mensagem amigável", "details": [...] }
```

**Autenticação** — JWT no header `Authorization: Bearer <token>`. O cliente salva em `localStorage.cbt_auth_token` e o `AuthContext` cacheia o user em `localStorage.cbt_auth_user` para evitar piscar a tela em refresh.

**Convenção de roles**
- Backend: enum Prisma `UPPER_CASE` (`ADMIN`, `ASSOCIATE`).
- Frontend: tipo string lowercase (`'admin'`, `'associate'`).
- Conversão em `frontend/src/services/authService.ts` → `mapRole()`.

**Padrão de permissão por endpoint:**

```ts
router.use(authMiddleware);                   // todas as rotas exigem JWT
router.get('/admin-only', requireRole('ADMIN'), handler);

// Self-or-admin (ex: ler dados pessoais)
if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
  return res.status(403).json({ success: false, error: 'Permissao negada' });
}
```

**O cliente HTTP (`frontend/src/services/api.ts`) NÃO redireciona em 401** — apenas loga. O `AuthContext` é quem decide invalidar a sessão (via background `getMe`). Esse design evita race conditions em F5 quando várias requisições disparam simultaneamente.

---

## Auditoria

Todas as mutações relevantes geram entradas em `AuditLog` via `backend/src/services/auditService.ts`. O service captura exceções internamente — falha de log nunca rebate na operação principal.

**Endpoints instrumentados:**

| Rota | Ação(ões) | EntityType |
|---|---|---|
| `POST /api/auth/login` | `LOGIN` | `User` |
| `POST /api/auth/logout` | `LOGOUT` | `User` |
| `PUT /api/auth/change-password` | `PASSWORD_CHANGE` | `User` |
| `POST/PUT/PATCH/DELETE /api/users(/:id...)` | `CREATE/UPDATE/STATUS_CHANGE/PASSWORD_CHANGE/DELETE` | `User` |
| `POST/PUT/PATCH/DELETE /api/visits(/:id...)` | `CREATE/UPDATE/STATUS_CHANGE/DELETE` | `Visit` |
| `POST/DELETE /api/transactions(/:id)` | `CREATE/DELETE` | `Transaction` |
| `POST/PATCH /api/loans(/:id/return)` | `LOAN_ISSUED/LOAN_RETURNED` | `Loan` |
| `POST /api/annuities` | `PAYMENT_RECEIVED` | `Annuity` |
| `POST/PUT/DELETE /api/news(/:id)` | `CREATE/UPDATE/DELETE` | `News` |
| `POST /api/stock/adjust` | `STOCK_ADJUSTMENT` | `StockItem` |

A página `/admin/logs` permite filtrar por entidade, ação, autor (`performedBy`) e data. Cada entrada armazena `previousData` / `newData` em JSON para diff.

---

## Emissão de declarações (Habitualidade CAC)

O portal emite **Declaração de Habitualidade** em PDF para o associado renovar o **Certificado de Registro (CR)** junto à Polícia Federal/Exército.

**Base regulatória**
- Decreto nº 11.615/2023.
- Portaria nº 166-COLOG/C Ex de 22/12/2023 — define o **Anexo E** (formato exigido).
- Portaria nº 260-COLOG/C Ex de 09/06/2025 — comprovação por **tipo de arma representativa**.
- IN DG/PF nº 311/2025 — Polícia Federal assumiu fiscalização do CR.

**Pré-requisito (admin)**
Em `/admin/cadastros → aba "Dados do Clube"`, preencha CNPJ, CR PJ, endereço completo, telefone, e-mail e o responsável legal (nome, CPF, cargo). O selo "Pronto para emitir Declarações" fica verde quando todos os campos críticos estão preenchidos. Sem isso, o portal do associado bloqueia o download da declaração.

**Fluxo do associado**
`/portal/habitualidade` → botão **Solicitar Declaração** → diálogo com seleção de ano + resumo → **Baixar declaração em PDF**. O arquivo `declaracao-habitualidade-{nº}-{ano}.pdf` é gerado no client com **jsPDF + jspdf-autotable** (texto vetorial, multipágina, pesquisável). Simultaneamente, um `MemberDocument` é registrado para histórico em `/portal/documentos` e `/admin/logs`.

**Conteúdo do PDF (Anexo E)**
- Cabeçalho do clube com logo, razão social, CNPJ, CR PJ, endereço e contato.
- Identificação do atirador: nome, CPF, nascimento, matrícula, CR + validade, nível CR, endereço.
- Período de referência (ano selecionado).
- Tabela detalhada com data, tipo (treinamento/competição), modalidade, calibre, arma e munição — com quebra automática de página.
- Totais por calibre (atende/pendente) + total geral.
- Texto declaratório citando explicitamente as portarias 166/2023 e 260/2025.
- Assinatura do responsável legal + carimbo do clube.
- Rodapé com numeração de páginas e timestamp.

---

## Banco de dados

**Workflow de schema:**
- Em **dev**, usamos `prisma db push` (`npm run db:push`) — aplica diferenças do `schema.prisma` direto no banco, sem gerar arquivo de migration.
- Em **produção**, gere migrations versionadas: `npx prisma migrate dev --name <descrição>`, commite o diretório `prisma/migrations/` e use `npx prisma migrate deploy` no deploy.
- O Prisma Client é regenerado automaticamente em `postinstall` (`npm run db:generate`).

**Modelos centrais:**

`User`, `UserAttachment`, `Visit`, `VisitDetail`, `Lane`, `Product`, `StockItem`, `StockMovement`, `Equipment`, `EquipmentLoan`, `Transaction`, `TransactionItem`, `AnnuityPayment`, `Expense`, `Event`, `EventParticipation`, `HabitualityRecord`, `MemberDocument`, `News`, `AuditLog`, `ClubSettings`.

**Soft delete:** `User`, `Product` e `Equipment` usam `isActive=false` em vez de `DELETE` físico, preservando integridade referencial das relações históricas.

**Catálogo de armas** (`backend/src/lib/firearmsCatalog.ts`) é espelhado em `frontend/src/lib/firearmsCatalog.ts` — **ao adicionar/remover uma arma, atualize os dois arquivos**.

---

## Build e deploy

### Backend
```bash
cd backend
npm install
npm run db:generate
# Em prod, rode com tsx (mantemos TS no runtime) ou compile com tsc se preferir
npm run start:prod
```

### Frontend
```bash
cd frontend
npm install
npm run build      # gera dist/
npm run preview    # opcional, valida o build local
```

`vercel.json` está pronto para deploy do frontend na Vercel (SPA com rewrites).

### Recomendações de produção
- Gerar `JWT_SECRET` aleatório de 64+ bytes.
- Restringir `ALLOWED_ORIGINS` apenas ao domínio público do frontend.
- HTTPS obrigatório (terminado num reverse proxy ou CDN).
- Trocar a senha do PostgreSQL no `docker-compose.yml` (ou usar Postgres gerenciado e remover o serviço Docker).
- Backup periódico do volume `cbt_postgres_data`.
- Manter `NODE_ENV=production` para esconder mensagens de erro internas.

---

## Troubleshooting

**"Docker daemon não está rodando"**
Abra o Docker Desktop e aguarde até estar healthy. Em Windows, pode levar 1-2 min após o login.

**Porta 3002 / 5173 / 5434 ocupada**
```bash
# Windows
netstat -ano | findstr :3002
taskkill /PID <PID> /F

# macOS / Linux
lsof -i :3002
kill -9 <PID>
```

**Erro Prisma `P1012` ou `EPERM` no Windows**
O backend está rodando e travou o `query_engine.dll`. Pare o processo do backend (Ctrl+C na janela) e rode:
```bash
cd backend && npm run db:push
```

**Banco corrompido / quero começar do zero**
```bash
docker compose down -v
docker compose up -d postgres
cd backend && npm run db:reset
```

**Frontend mostra "Network error"**
1. Confira se o backend responde em http://localhost:3002/health (deve retornar `{"success":true,...}`).
2. Verifique `frontend/.env` → `VITE_API_URL=http://localhost:3002`.
3. Reinicie o frontend (Ctrl+C + `npm run dev`).

**PowerShell bloqueando scripts (Windows)**
O `start-dev.bat` já passa `-ExecutionPolicy Bypass`. Se ainda falhar:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Licença

Projeto interno do Clube Baiano de Tiro — uso restrito.
