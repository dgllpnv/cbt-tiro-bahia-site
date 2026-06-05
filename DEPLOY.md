# 🚀 Manual de Deploy — Portal CBT

> **Filosofia:** o sistema **já está em produção e em uso real pelo clube**.
> Toda mudança deve ser um **progresso**, **nunca um regresso**.
> Em hipótese alguma um deploy pode apagar, corromper ou indisponibilizar
> dados/funcionalidades que já estão rodando.

Este documento é o **passo a passo oficial** para subir alterações com segurança.
Leia as **Regras de Ouro** antes de qualquer coisa.

---

## ⚡ Manual Rápido (TL;DR)

**Mudou só frontend/lógica (sem schema)?** → `git push origin master` + Rebuild no EasyPanel. **Fim.**

**Mudou `schema.prisma` ou precisa migrar dados?** Siga os 5 passos:

```bash
# 0) BACKUP  — console do cbt-postgres
pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > /tmp/cbt-backup-$(date +%F-%H%M).sql

# 1) CÓDIGO  — no seu PC
git push origin master

# 2) REBUILD — EasyPanel: cbt-backend e cbt-frontend
#    (conferir VITE_API_URL como Build Arg no cbt-frontend)

# 3) SCHEMA  — console do cbt-backend (aditivo: NÃO apaga dados)
cd /app && npx prisma db push --skip-generate

# 4) DADOS   — só se a tarefa pedir; SEMPRE dry-run antes
npx tsx scripts/<script>.ts            # dry-run: confira os números
npx tsx scripts/<script>.ts --apply    # aplica de verdade

# 5) CONFERIR — abrir o site + contagem de sócios igual à de antes
```

> 🔒 **Regra inquebrável:** só mudanças **aditivas** (tabela nova, coluna nullable,
> valor novo de enum). **Nunca** rode `--force-reset`, `db:reset`,
> `migrate:adm:apply`, `db:seed:all` ou `--accept-data-loss` em produção.
> Se o `db push` falar em *"data loss"*, **PARE** — a mudança não era aditiva.

📖 *Backup, rollback, matriz aditivo×destrutivo e armadilhas → seções abaixo.*

---

## 🗺️ Como o deploy funciona

| Componente | O que é | Onde roda |
|---|---|---|
| **GitHub** | Fonte da verdade do código (branch `master`) | `github.com/dgllpnv/cbt-tiro-bahia-site` |
| **EasyPanel** | Orquestra os containers; puxa o código do GitHub e faz build | `2.24.79.49` |
| `cbt-backend` | API Express + Prisma | container Node |
| `cbt-frontend` | Site/SPA (build Vite servido por nginx) | container nginx |
| `cbt-postgres` | Banco PostgreSQL (`cbt_portal`) | container Postgres |

**Fluxo:** você faz `git push` → o EasyPanel rebuilda os serviços a partir do
novo commit → mudanças de banco são aplicadas **manualmente** no console do
`cbt-backend` (o EasyPanel **não** roda migração sozinho).

---

## 🛑 Regras de Ouro (NUNCA quebrar)

Estes comandos **destroem ou duplicam dados de produção**. **Nunca** rode no
`cbt-backend`/`cbt-postgres` de produção:

| ⛔ Comando | Por que é proibido |
|---|---|
| `prisma db push --force-reset` | **Apaga o banco inteiro** antes de aplicar |
| `prisma migrate reset` | Idem — recria do zero |
| `npm run db:reset` | Nuke + reseed |
| `npm run migrate:adm:apply` | Faz **cleanup geral** (era só para popular do zero na 1ª vez) |
| `npm run db:seed:all` / `db:seed:*` | **Duplica** dados que já existem |
| `prisma db push --accept-data-loss` | Ignora avisos de perda de dados — **se o push pedir isso, PARE** |

> ✅ O comando seguro para aplicar schema é **`npx prisma db push`** (sem flags
> destrutivas). Ele só aplica mudanças **aditivas** sem tocar nos dados.

---

## 🧭 Princípio: mudança **aditiva** vs **destrutiva**

O `prisma db push` é seguro **quando a mudança é aditiva**. Saiba diferenciar:

| ✅ Aditivo (seguro, sem perda) | ⚠️ Destrutivo (exige cuidado/planejamento) |
|---|---|
| Adicionar **tabela** nova | Remover/renomear tabela |
| Adicionar **coluna nullable** (`String?`) | Remover/renomear coluna |
| Adicionar **valor a um enum** | Remover valor de enum |
| Adicionar **índice/relação** | Mudar tipo de coluna (ex: `String`→`Int`) |
| Adicionar coluna com `@default(...)` | Adicionar coluna `NOT NULL` sem default em tabela populada |

> Se a sua mudança cair na coluna da direita, **não faça push direto**: planeje
> uma migração em etapas (adicionar → backfill → remover depois) e **sempre**
> faça backup antes. Na dúvida, trate como destrutivo.

---

## ✅ Checklist rápido (TL;DR)

```
[ ] 0. Backup do banco (pg_dump)           → cbt-postgres
[ ] 1. git push origin master              → no seu PC
[ ] 2. Rebuild cbt-backend e cbt-frontend  → EasyPanel
[ ] 3. npx prisma db push (se mudou schema)→ cbt-backend
[ ] 4. Migração de dados (se houver, c/ dry-run) → cbt-backend
[ ] 5. Verificar o site em produção
```

Se a alteração **não toca no schema nem em dados** (só frontend/lógica), pule os
passos 3 e 4 — basta push + rebuild.

---

## 📋 Passo a passo detalhado

### Passo 0 — Backup do banco (SEMPRE antes de schema/dados)

No **console do `cbt-postgres`**:

```bash
pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > /tmp/cbt-backup-$(date +%F-%H%M).sql
ls -lh /tmp/cbt-backup-*.sql
```

Baixe o arquivo (file manager do EasyPanel) e guarde. É a rede de segurança para
o rollback. **Pule o backup só se a mudança for puramente de frontend.**

> Se as variáveis estiverem vazias, pegue os valores em `cbt-backend` →
> `DATABASE_URL`, ou em `cbt-postgres` → Environment (`POSTGRES_USER`,
> `POSTGRES_DB`). O banco é o `cbt_portal`.

---

### Passo 1 — Enviar o código para o GitHub

No seu computador:

```bash
git status                 # confira o que vai
git push origin master
```

> O `CLAUDE.md` fica local de propósito (instruções do agente) — não vai pro deploy.

---

### Passo 2 — Rebuild no EasyPanel

1. **cbt-backend** → **Deploy/Rebuild** (puxa o novo commit).
2. **cbt-frontend** → **Deploy/Rebuild**.

⚠️ **Antes de buildar o frontend**, confirme o Build Arg:

| Variável | Onde | Valor |
|---|---|---|
| `VITE_API_URL` | cbt-frontend → **Build Args** (não env!) | URL pública da API de produção |

> `VITE_*` é embutido **no build** — se faltar, o site sobe apontando pra lugar
> nenhum. Esta é a armadilha nº 1 do projeto.

Aguarde os dois ficarem **healthy/verdes**. O site já sobe aqui — mas se houver
schema novo, telas que dependem dele só funcionam após o Passo 3.

---

### Passo 3 — Aplicar mudanças de schema (só se `schema.prisma` mudou)

No **console do `cbt-backend`**:

```bash
cd /app
npx prisma db push --skip-generate
```

- ✅ Esperado: **"Your database is now in sync with your Prisma schema"** em ~200ms.
- ⛔ Se aparecer **"may result in data loss"** ou pedir `--accept-data-loss`:
  **NÃO confirme, cancele (Ctrl+C)** e reavalie — a mudança não era aditiva.

> `--skip-generate` porque o Prisma Client já foi gerado no build do container.

---

### Passo 4 — Migração de dados (só quando a tarefa exigir)

Scripts que **transformam dados** (ex.: mover registros entre tabelas) sempre têm
**dry-run**. **Rode o dry-run primeiro, confira os números, só então aplique.**

Padrão:

```bash
cd /app
npx tsx scripts/<script>.ts            # DRY-RUN — não grava nada
# confira os números na saída...
npx tsx scripts/<script>.ts --apply    # aplica de verdade
```

Se o script ler o CSV protegido, descriptografe antes (usa a `MIGRATION_PASSPHRASE`
já configurada no ambiente) e **apague o arquivo em claro depois**:

```bash
npx tsx scripts/csv-crypto.ts decrypt data/backup_adm_clube.csv.enc data/backup_adm_clube.csv
# ... rodar a migração ...
rm data/backup_adm_clube.csv   # contém CPFs em texto puro — não pode ficar
```

> Bons scripts de migração são **idempotentes** (rodar 2x não duplica). Em caso
> de dúvida se concluiu, rode o dry-run de novo: ele deve mostrar "0 a fazer".

---

### Passo 5 — Verificação em produção

Em **https://clubebaianodetiro.tech/**, confirme:

- [ ] Site público abre rápido; logo e imagens carregam.
- [ ] Login **admin** funciona.
- [ ] A **contagem de sócios** continua a mesma de antes do deploy.
- [ ] As funcionalidades novas da entrega funcionam.
- [ ] Nada que funcionava antes parou (sanity check das telas principais).

Verificação de contagem (console do `cbt-backend`):

```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); (async()=>{console.log('Sócios:', await p.user.count()); console.log('Equipment:', await p.equipment.count()); await p.\$disconnect();})()"
```

---

## ⏪ Rollback (se algo der errado)

1. **Código:** no EasyPanel, faça **re-deploy do commit anterior** (estável).
2. **Banco** (só se necessário — raríssimo com mudança aditiva): restaure o dump
   do Passo 0, no console do `cbt-postgres`:
   ```bash
   psql -U "$POSTGRES_USER" "$POSTGRES_DB" < /tmp/cbt-backup-<data>.sql
   ```

> Como o caminho seguro usa apenas mudanças **aditivas**, o banco quase nunca
> precisa de rollback — o código volta, o banco fica (compatível).

---

## ⚠️ Armadilhas conhecidas do projeto

| Tema | Cuidado |
|---|---|
| **VITE_API_URL** | É **Build Arg** do cbt-frontend, não env var. Faltando = site sem API. |
| **MIGRATION_PASSPHRASE** | Env var do cbt-backend. Necessária para o bootstrap e para descriptografar o CSV. Nunca colar a senha em chat/commit. |
| **Bootstrap automático** | `bootstrapMissingMembers()` roda no startup; é idempotente (checa sócio `0001`). Em prod populado, é no-op. Não interferir. |
| **CORS** | Aceita `*.easypanel.host` por regex + o domínio em `ALLOWED_ORIGINS`. Domínio próprio (`clubebaianodetiro.tech`) precisa estar no `ALLOWED_ORIGINS`. |
| **Galeria por arquivo** | Fotos em `/site/galeria/*` são servidas como estáticos. Trocar extensão/nome exige `UPDATE` nas referências do banco. |
| **Cap da galeria** | Máx. **50** imagens (front e back). |
| **`firearmsCatalog.ts`** | Duplicado em `frontend/src/lib` e `backend/src/lib`. Mudou um, mude o outro. |
| **Migração só roda manual** | O EasyPanel **não** roda `db push`/migração no deploy. É sempre passo manual no console. |
| **Backups (export)** | O admin pode exportar o banco cifrado em **Exportação dos dados**; o `.html` baixado descriptografa por duplo-clique (não substitui o `pg_dump`, mas é um backup extra rápido). |

---

## 📌 Resumo de uma linha

> **Backup → push → rebuild → `db push` (aditivo) → migração (com dry-run) → verificar.**
> Aditivo sempre. Destrutivo nunca sem plano. Progressos, jamais regressos.
