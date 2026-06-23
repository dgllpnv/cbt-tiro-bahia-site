# Tutorial completo — Deploy de aplicação fullstack no Hostinger + EasyPanel

> Guia passo-a-passo para subir uma aplicação **Node/Express + React/Vite + PostgreSQL** numa **VPS Hostinger** gerenciada pelo **EasyPanel**. Escrito para que qualquer pessoa, mesmo sem experiência prévia em deploy, consiga concluir do início ao fim.

---

## Sumário

1. [Antes de começar — visão geral e o que você precisa](#1-antes-de-começar)
2. [Conceitos fundamentais (leia antes do passo 3)](#2-conceitos-fundamentais)
3. [Fase 1 — Configurar o DNS no Hostinger](#fase-1--configurar-o-dns-no-hostinger)
4. [Fase 2 — Gerar segredos e fazer backup do banco local](#fase-2--gerar-segredos-e-fazer-backup-do-banco-local)
5. [Fase 3 — Criar o projeto no EasyPanel + serviço de banco](#fase-3--criar-o-projeto-no-easypanel--serviço-de-banco)
6. [Fase 4 — Subir o serviço Backend](#fase-4--subir-o-serviço-backend)
7. [Fase 5 — Subir o serviço Frontend](#fase-5--subir-o-serviço-frontend)
8. [Fase 6 — Migrar o banco de dados (se aplicável)](#fase-6--migrar-o-banco-de-dados)
9. [Fase 7 — Smoke test em produção](#fase-7--smoke-test-em-produção)
10. [Fase 8 — Hardening pós-deploy](#fase-8--hardening-pós-deploy)
11. [Apêndice A — Como atualizar coisas depois](#apêndice-a--como-atualizar-coisas-depois)
12. [Apêndice B — Problemas comuns e soluções](#apêndice-b--problemas-comuns-e-soluções)
13. [Apêndice C — Glossário](#apêndice-c--glossário)

---

## 1. Antes de começar

### 1.1 — O que esse tutorial faz

Ao final, você terá:

- Sua aplicação acessível via `https://seudominio.com` (frontend)
- Sua API acessível via `https://api.seudominio.com` (backend)
- Banco de dados PostgreSQL rodando isolado (sem exposição pública)
- HTTPS automático (Let's Encrypt)
- Dados migrados do seu ambiente local de desenvolvimento (opcional)
- Senha de administrador trocada
- Backup automático configurado

### 1.2 — Pré-requisitos (confirme que você tem tudo antes de começar)

| Item | Por que precisa | Como obter |
|---|---|---|
| **VPS Hostinger** com EasyPanel já instalado | É onde sua aplicação vai rodar | Painel Hostinger → VPS → confirme que tem servidor ativo. EasyPanel é instalado durante a configuração inicial do VPS pela Hostinger. |
| **IP público da VPS** | Apontar o domínio para esse IP | Painel Hostinger → VPS → seu servidor → "Visão geral". Anote (vai ser tipo `123.45.67.89`). |
| **Acesso SSH** (usuário, senha, porta) | Você vai precisar pra subir o backup do banco | Painel Hostinger → VPS → "Acesso SSH". Geralmente: usuário `root`, porta `22`. Senha foi enviada por email ou está visível no painel. |
| **Domínio próprio** | É o endereço que as pessoas vão acessar | Pode comprar na própria Hostinger, em registro.br, GoDaddy, etc. Esse tutorial assume que está na Hostinger. |
| **Repositório no GitHub** (público) | EasyPanel puxa o código de lá pra fazer build | https://github.com/seu-usuario/seu-repo. Se ainda não está lá, faça `git push` antes. |
| **Aplicação dockerizada** | EasyPanel constrói imagens Docker pra rodar | Você precisa ter `Dockerfile` no backend e no frontend. Esse tutorial assume que existe. |
| **Computador com Docker e cliente SSH** | Para gerar backup do banco e fazer transferências | Docker Desktop (Windows/Mac) ou Docker (Linux). SSH client: já vem no Win 10+, macOS e Linux. |

### 1.3 — Quanto tempo demora

- Configuração ativa: **45-90 minutos** se tudo correr bem
- Espera de propagação de DNS: **5 minutos a 2 horas** (paralelo, não trava)
- Build inicial dos serviços: **3-7 minutos por serviço**

Reserve **2 horas tranquilas** para fazer com calma.

---

## 2. Conceitos fundamentais

> **Leia este capítulo antes de começar.** Entender esses 5 conceitos vai economizar bastante tempo.

### 2.1 — O que é o EasyPanel

EasyPanel é um **painel web** que roda na sua VPS e gerencia containers Docker. Ele faz por você:

- Build de imagens Docker a partir do GitHub
- Roteamento de domínios (Traefik por baixo)
- HTTPS automático (Let's Encrypt)
- Gerenciamento de variáveis de ambiente
- Logs, métricas, restart, etc.

Você acessa em `http://<IP_VPS>:3000` no navegador.

### 2.2 — Como o EasyPanel organiza coisas

```
EasyPanel
├── Projeto "cbt"  (agrupador)
│   ├── Serviço "cbt-postgres"   (template oficial Postgres)
│   ├── Serviço "cbt-backend"    (App, build a partir do Dockerfile)
│   └── Serviço "cbt-frontend"   (App, build a partir do Dockerfile)
└── Outros projetos...
```

Cada **serviço** é um container Docker rodando.

### 2.3 — Por que dois subdomínios separados (frontend e api)

A escolha que vamos fazer:

```
seudominio.com           → frontend (interface web)
api.seudominio.com       → backend (API JSON)
```

**Vantagem:** o navegador vê dois "domínios" diferentes, então o CORS é explícito (mais seguro), os certificados HTTPS são separados, e fica fácil debugar problemas de rede.

A alternativa seria `seudominio.com/api/...` (proxy reverso pro backend), que é mais complexa de configurar e mais difícil de debugar.

### 2.4 — A diferença entre "Build time" e "Runtime"

Esse é o conceito que mais gera confusão. Existem duas categorias de variáveis de configuração:

| Categoria | Quando é lida | Exemplo | Mudou? Como aplicar |
|---|---|---|---|
| **Build time** | Durante a construção da imagem Docker | `VITE_API_URL` (Vite congela no JS final) | Precisa **Implantar** (gera nova imagem) |
| **Runtime** | Quando o container está rodando | `JWT_SECRET`, `DATABASE_URL` (Express lê quando inicia) | Basta **Reiniciar** (mesmo container) |

**Regra de bolso:**
- Frontend (Vite) → mudou variável → **Implantar** (rebuild ~3-5 min)
- Backend (Express) → mudou variável → **Reiniciar** (~10s)

### 2.5 — O fluxo do deploy

```
1. Você faz push pro GitHub (master)
2. EasyPanel detecta o commit novo
3. Você clica "Implantar" (ou ele faz automático se configurado)
4. EasyPanel clona o repo na VPS
5. Roda `docker build` usando o Dockerfile
6. Sobe o container novo, derruba o antigo
7. O Traefik (reverse proxy) atualiza o roteamento
8. Done — sua aplicação atualizou
```

Pronto. Vamos começar.

---

## Fase 1 — Configurar o DNS no Hostinger

### Por que essa fase é primeiro

A propagação de DNS leva de 5 minutos a 2 horas. Se você configurar agora, enquanto faz o resto, ela termina em paralelo. Se deixar pro final, vai ficar esperando.

### 1.1 — Acessar a Zona DNS

1. Entre no painel da Hostinger: https://hpanel.hostinger.com
2. No menu superior, clique em **"Domínios"**
3. Encontre seu domínio na lista (ex: `clubebaianodetiro.com.br`)
4. Clique no botão **"Gerenciar"** ao lado dele
5. No menu lateral esquerdo, procure **"Zona DNS"** ou **"DNS / Nameservers"**
6. Clique. Você verá uma tabela de "registros DNS" — entradas que dizem "esse domínio aponta pra esse IP".

### 1.2 — Limpar registros antigos (se houver)

Você provavelmente verá registros A pré-existentes apontando para um IP de "parking" da Hostinger. Vamos remover:

1. Localize qualquer registro tipo `A` apontando para IPs estranhos (ex: `185.230.63.X`, IPs de "parking")
2. Clique no ícone de **lixeira** ao lado de cada um
3. Confirme a exclusão

Mantenha intactos:
- Registros tipo `MX` (email)
- Registros tipo `TXT` (verificação de propriedade)
- Registros `NS` (nameservers — não mexa nesses)

### 1.3 — Adicionar os registros novos

Você vai criar **2 registros A**. Um para o domínio raiz, outro para o subdomínio `api`.

**Como adicionar registro 1 (domínio raiz):**

1. Clique em **"Adicionar Registro"** ou **"+ Novo Registro"**
2. Preencha o formulário:
   - **Tipo:** `A`
   - **Nome (ou Host):** `@` *(o `@` é uma convenção que significa "o domínio raiz", ou seja, `seudominio.tld` direto sem subdomínio)*
   - **Aponta para (ou Valor / IPv4):** `<IP_DA_SUA_VPS>` *(exemplo: `123.45.67.89`)*
   - **TTL:** `3600` *(é o tempo em segundos que o cache do DNS vai guardar essa info; 3600 = 1 hora, padrão razoável)*
3. Clique em **"Salvar"** ou **"Adicionar"**

**Como adicionar registro 2 (subdomínio api):**

1. Clique em **"Adicionar Registro"** novamente
2. Preencha:
   - **Tipo:** `A`
   - **Nome:** `api`
   - **Aponta para:** `<IP_DA_SUA_VPS>` *(mesmo IP do registro anterior)*
   - **TTL:** `3600`
3. Salve

**(Opcional) Adicionar redirect de `www`:**

Se você quer que `www.seudominio.tld` também funcione (redirecionando para `seudominio.tld`):

1. Adicionar Registro
2. Preencha:
   - **Tipo:** `CNAME`
   - **Nome:** `www`
   - **Aponta para:** `seudominio.tld.` *(com o ponto final, importante na sintaxe DNS)*
   - **TTL:** `3600`

### 1.4 — Verificar a propagação

Depois de salvar, vai levar de 5 minutos a 2 horas para o resto da internet "saber" do seu novo registro.

**Como testar:**

Abra um terminal (CMD, PowerShell, Terminal do Mac/Linux) e digite:

```bash
nslookup api.seudominio.tld
```

Se você vir uma resposta tipo:
```
Name:    api.seudominio.tld
Address: 123.45.67.89  ← seu IP da VPS
```

Pronto, propagou. Pode prosseguir confiante.

Se aparecer **"can't find"** ou IP diferente, **espere mais um pouco** e tente de novo a cada 10-15 min. Não é necessário esperar para começar as próximas fases — só é necessário no momento de habilitar HTTPS automático nas Fases 4 e 5.

---

## Fase 2 — Gerar segredos e fazer backup do banco local

### 2.1 — Gerar JWT_SECRET para produção

`JWT_SECRET` é a chave que o backend usa para assinar tokens de login. Em produção, **nunca use uma string fácil ou a mesma do desenvolvimento**. Vamos gerar uma aleatória.

No terminal do seu PC (precisa do Node.js instalado):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

A saída será uma string longa de 128 caracteres hexadecimais, tipo:
```
f3a8d2c1b9...e7f4
```

**Copie essa string e guarde** num bloco de notas seguro. Você vai colar no EasyPanel mais tarde.

> 💡 **Por que 128 chars?** Cada char hex = 4 bits, 128 chars = 512 bits = 64 bytes. É o tamanho recomendado pra ser seguro contra ataques de força bruta no futuro previsível.

### 2.2 — Fazer backup do banco local (se for migrar dados)

⚠️ **Pule esta etapa se for um deploy zerado, sem dados pré-existentes.**

#### O cuidado importante: NÃO use `>` (redirect) no Windows

No Windows, o comando `pg_dump ... > arquivo.dump` **corrompe arquivos binários** porque o PowerShell/CMD trata o stdout como texto e adiciona BOM UTF-8 no começo, destruindo a assinatura do dump.

Use sempre a flag `-f` do `pg_dump`, que escreve direto no arquivo sem passar pelo shell.

#### Passo a passo

**1. Descubra o nome do container Postgres local:**

```bash
docker ps --format "{{.Names}}"
```

Procure o que tem "postgres" no nome. Pode ser `cbt-postgres`, `meu-app_postgres_1`, etc. Anote como `<NOME_PG_LOCAL>`.

> Se nada aparecer, é porque o Postgres local não está rodando. Suba ele primeiro (`docker compose up -d postgres` ou similar).

**2. Gerar o dump dentro do container e copiar pro PC:**

```bash
docker exec <NOME_PG_LOCAL> pg_dump -U postgres -F c -f /tmp/cbt_backup.dump <NOME_DO_BANCO>
docker cp <NOME_PG_LOCAL>:/tmp/cbt_backup.dump cbt_backup.dump
docker exec <NOME_PG_LOCAL> rm /tmp/cbt_backup.dump
```

Substitua:
- `<NOME_PG_LOCAL>` pelo nome que descobriu (ex: `cbt-postgres`)
- `<NOME_DO_BANCO>` pelo nome do banco (ex: `cbt_portal`)

**Explicação dos parâmetros:**
- `-U postgres` → usuário do Postgres local (pode ser diferente do seu setup; ajuste se necessário)
- `-F c` → formato **custom**, comprimido e indexado, ideal para `pg_restore`
- `-f /tmp/cbt_backup.dump` → arquivo de saída **dentro do container**
- `docker cp` → copia o arquivo do container pro seu PC sem corromper

**3. Verificar que o dump está válido:**

Os primeiros 5 bytes de um dump custom válido são `PGDMP` em ASCII. Vamos confirmar.

**Linux/macOS/WSL:**
```bash
head -c 5 cbt_backup.dump
```

**Windows (PowerShell):**
```powershell
powershell -c "Get-Content -Encoding Byte -TotalCount 5 cbt_backup.dump | ForEach-Object {[char]$_}"
```

**O que você deve ver:** `PGDMP`

Se aparecer caracteres estranhos (`��PG`, `<-?`, etc.) ou nada, o arquivo está **corrompido**. Isso quase sempre é causado por ter usado `>` em vez de `-f`. Refaça do passo 2.

**4. Anotar o tamanho e local do arquivo:**

```bash
# Linux/macOS/WSL
ls -lh cbt_backup.dump

# Windows
dir cbt_backup.dump
```

Anote o tamanho (geralmente 1-50MB para apps típicos). Vai ser útil saber depois quando confirmar que a transferência SCP foi completa.

---

## Fase 3 — Criar o projeto no EasyPanel + serviço de banco

### 3.1 — Acessar o EasyPanel

1. Abra o navegador e digite: `http://<IP_VPS>:3000`
2. Tela de login do EasyPanel aparece
3. Use as credenciais que você definiu na primeira vez que abriu o EasyPanel
   - Se nunca abriu: a Hostinger pode ter pré-definido. Veja a documentação ou painel da Hostinger para a senha inicial.
4. Você cai no dashboard

### 3.2 — Criar o Projeto

1. No menu lateral esquerdo, clique em **"Projetos"** (ou "Projects")
2. No canto superior direito, clique em **"+ Criar Projeto"** (ou "+ New Project")
3. Modal abre pedindo nome do projeto
4. Digite: `cbt` (ou outro nome curto, sem espaços, só letras minúsculas e hífens)
5. Clique em **"Criar"**
6. Você é redirecionado para a página do projeto (vazia, com "Nenhum serviço ainda")

### 3.3 — Adicionar o serviço PostgreSQL

1. Dentro da página do projeto `cbt`, clique no botão **"+ Serviço"** (canto superior direito)
2. Aparece uma tela com tipos de serviço. Clique em **"Postgres"** (ou "PostgreSQL")
3. Formulário aparece. Preencha:

   | Campo | Valor a digitar |
   |---|---|
   | **Nome do Serviço** | `cbt-postgres` |
   | **Versão da Imagem** | `16-alpine` (ou só `16` se houver dropdown) |
   | **Banco de Dados** | `cbt_portal` |
   | **Usuário** | `cbt_user` |
   | **Senha** | clique em "Gerar" se houver botão; senão crie uma forte (24+ caracteres aleatórios). **Anote em local seguro AGORA**, você vai precisar dela. |

4. **NÃO marque "Expor Externamente" / "Public Port"** — Postgres deve ficar só na rede interna por segurança
5. Volume Persistente já vem habilitado por padrão (não desabilite, senão você perde os dados se o container for recriado)
6. Clique em **"Criar"** ou **"Implantar"**
7. Aguarde 30-60 segundos. O status do serviço deve ficar verde (🟢 Running).

### 3.4 — Anotar a connection string interna

Os outros serviços (backend) vão precisar saber como conectar nesse Postgres. O endereço interno segue o padrão do EasyPanel:

```
postgresql://cbt_user:<SUA_SENHA>@cbt_cbt-postgres:5432/cbt_portal
```

Notou o `cbt_cbt-postgres`? **É proposital.** O EasyPanel prefixa o nome do serviço com o nome do projeto, separados por underline. Como o projeto é `cbt` e o serviço é `cbt-postgres`, o hostname interno fica `cbt_cbt-postgres`.

Você pode confirmar isso na aba **"Visão Geral"** ou **"Conexão"** do serviço — geralmente tem uma string copiável lá.

**Anote essa connection string completa** num bloco de notas. Vai ser usada na próxima fase.

---

## Fase 4 — Subir o serviço Backend

### 4.1 — Criar o serviço

1. Dentro do projeto `cbt`, clique em **"+ Serviço"**
2. Escolha **"App"** (não Postgres dessa vez — App é pra qualquer aplicação customizada)
3. Modal pede nome do serviço. Digite: `cbt-backend`
4. Confirme. Você cai na tela do serviço (com várias abas no menu lateral: Visão Geral, Fonte, Implantações, Ambiente, Domínios, etc.)

### 4.2 — Aba **Fonte** (configurar de onde vem o código)

1. Clique na aba **"Fonte"** no menu lateral
2. Em **"Tipo"** selecione **"GitHub"**
3. Preencha:

   | Campo | Valor |
   |---|---|
   | **Proprietário** | `seu-usuario-do-github` (ex: `dgllpnv`) |
   | **Repositório** | nome do repo (ex: `cbt-tiro-bahia-site`) |
   | **Ramo** | `master` ou `main` (confira no GitHub qual é a sua branch principal) |
   | **Caminho de Build** | `/backend` ⚠️ **importante** — com a barra inicial. Isso diz ao EasyPanel que o `Dockerfile` está em `<repo>/backend/Dockerfile`. Se sua app não é monorepo (Dockerfile na raiz), use `/`. |

4. Mais abaixo, na seção **"Construção"**:
   - Selecione **"Dockerfile"** (entre as opções: Dockerfile, Buildpacks, Nixpacks, Railpack)
   - Em **"Arquivo"**, deixe `Dockerfile` (relativo ao Caminho de Build)

5. Clique em **"Salvar"**

### 4.3 — Aba **Ambiente** (variáveis de configuração)

Aqui você vai colocar todas as variáveis que o backend precisa para rodar.

1. Clique na aba **"Ambiente"** no menu lateral
2. Você verá um editor de texto. Cole **tudo de uma vez** (substitua os placeholders pelos valores reais):

```env
DATABASE_URL=postgresql://cbt_user:SUA_SENHA_PG@cbt_cbt-postgres:5432/cbt_portal
DIRECT_URL=postgresql://cbt_user:SUA_SENHA_PG@cbt_cbt-postgres:5432/cbt_portal
JWT_SECRET=COLOQUE_AQUI_A_STRING_DE_128_CHARS_DA_FASE_2
JWT_EXPIRES_IN=7d
PORT=3002
NODE_ENV=production
ALLOWED_ORIGINS=https://seudominio.tld
```

**Onde substituir:**
- `SUA_SENHA_PG` → a senha do Postgres da Fase 3
- `COLOQUE_AQUI_A_STRING_DE_128_CHARS_DA_FASE_2` → o JWT_SECRET gerado na Fase 2
- `seudominio.tld` → seu domínio real (ex: `clubebaianodetiro.com.br`)

⚠️ **Cuidados:**
- **Sem aspas** ao redor dos valores
- **Sem espaços extras** (nem antes do `=`, nem depois)
- Cada variável em uma linha
- `ALLOWED_ORIGINS` é a lista de domínios autorizados a chamar a API. Por enquanto só o domínio principal. Vírgula sem espaço pra adicionar mais.

3. Clique em **"Salvar"**

### 4.4 — Aba **Domínios** (configurar URL pública)

1. Clique na aba **"Domínios"** no menu lateral
2. Clique em **"+ Adicionar Domínio"**
3. Formulário aparece. Preencha **com cuidado**:

   | Campo | Valor a digitar | ⚠️ Cuidados |
   |---|---|---|
   | **Host** | `api.seudominio.tld` | **Apenas o domínio puro.** Sem `https://` no campo. Sem barra `/` no início ou fim. Sem espaços. |
   | **Path** | `/` | **Uma barra só.** Não `//`, não vazio. |
   | **Porta** | `3002` | Esta é a porta que o **container** expõe internamente. Como o backend escuta na 3002 (definido no `Dockerfile` e em `PORT=3002` no Ambiente), é essa. |
   | **HTTPS** | ✓ marcado | Ativa Let's Encrypt automático |

4. Clique em **"Salvar"** ou **"Adicionar"**

### 4.5 — Aba **Recursos** (alocar CPU/RAM)

1. Clique na aba **"Recursos"**
2. Para começar, deixe os defaults: **1 CPU, 512 MB RAM**
3. Salve. Pode aumentar depois se precisar.

### 4.6 — Implantar (build + start)

1. Clique na aba **"Implantações"** no menu lateral
2. Clique no botão grande verde **"Implantar"** no topo
3. EasyPanel vai começar o processo:
   - Clonar o repo (~10s)
   - Buildar a imagem Docker (~3-6 min na primeira vez)
   - Subir o container
   - Configurar HTTPS (Let's Encrypt — exige DNS propagado)
4. **Acompanhe os logs:** clique na aba **"Logs"** durante o build
5. Build bem-sucedido aparece linhas tipo:
   ```
   Successfully built abc123def456
   Successfully tagged easypanel/cbt-cbt-backend:latest
   ```
6. Container rodando aparece (no log do **runtime**, separado do log de build):
   ```
   ========================================
     <SUA-APP> Backend
     Servidor rodando na porta 3002
     Ambiente: production
   ========================================
   ```

### 4.7 — Verificar que o backend responde

Aguarde o DNS ter propagado (Fase 1.4). Depois, no seu PC:

```bash
curl https://api.seudominio.tld/health
```

**Resposta esperada:**
```json
{"success":true,"data":{"status":"healthy","timestamp":"2026-...","environment":"production"}}
```

Se retornar **HTML** em vez de JSON, há problema de roteamento — pule para [Apêndice B](#apêndice-b--problemas-comuns-e-soluções), seção "API retorna HTML do frontend".

Se aparecer erro de SSL como "self-signed certificate" ou "untrusted":
- Aguarde mais 5-10 min — Let's Encrypt está emitindo o cert
- Use `curl -k` para ignorar SSL temporariamente e ver se a API responde por baixo

---

## Fase 5 — Subir o serviço Frontend

### 5.1 — Criar o serviço

1. Projeto `cbt` → **"+ Serviço"** → **"App"**
2. Nome: `cbt-frontend`

### 5.2 — Aba **Fonte**

Mesmo padrão do backend, com diferenças:

| Campo | Valor |
|---|---|
| **Tipo** | GitHub |
| **Proprietário/Repositório** | mesmo do backend |
| **Ramo** | mesmo do backend |
| **Caminho de Build** | `/frontend` ⚠️ — Dockerfile do frontend mora aí |

Em **Construção**: Dockerfile, arquivo `Dockerfile`. Salvar.

### 5.3 — Aba **Ambiente** ⚠️ **PONTO CRÍTICO**

Aqui é onde a maioria das pessoas trava. O frontend precisa saber **a URL da API** durante o build (não em runtime), porque Vite congela isso no JS final.

A versão atual do EasyPanel (em português) **não tem aba "Build Args" dedicada**. Mas tem uma feature mágica: **variáveis de Ambiente são automaticamente repassadas como `--build-arg`** quando o Dockerfile declara `ARG NOME`. Como o `Dockerfile` do frontend declara `ARG VITE_API_URL`, basta colocar a variável aqui.

1. Clique na aba **"Ambiente"**
2. Cole apenas isto (uma única variável):
   ```env
   VITE_API_URL=https://api.seudominio.tld
   ```
3. Salvar

⚠️ **Atenção redobrada:**
- A URL deve apontar para o **backend** (subdomínio `api`), não para o próprio frontend
- Inclua `https://`
- **Sem barra** no final
- Sempre que mudar essa variável, **precisa Implantar (rebuild)**, não basta Reiniciar — Vite congela em build time

### 5.4 — Aba **Domínios** (você adiciona DOIS)

#### Domínio principal

1. **+ Adicionar Domínio**
2. Preenche:
   - **Host:** `seudominio.tld` *(o domínio raiz, sem `api.` na frente)*
   - **Path:** `/`
   - **Porta:** `80` *(porta interna do nginx do container frontend)*
   - **HTTPS:** ✓
3. Salvar

#### Domínio www (opcional, mas recomendado)

1. **+ Adicionar Domínio** novamente
2. Preenche:
   - **Host:** `www.seudominio.tld`
   - **Path:** `/`
   - **Porta:** `80`
   - **HTTPS:** ✓
3. Se houver opção "Redirect to" ou "Redirecionar para", aponte para `https://seudominio.tld` (assim www redireciona automático para o domínio principal)
4. Salvar

### 5.5 — Aba **Recursos**

⚠️ **Importante:** o build do Vite é pesado (Tailwind + libs como jsPDF, Human, etc. consomem bastante memória).

- **Memória:** **1024 MB durante o build** (256 MB causa OOM kill)
- **CPU:** 0.5 ou 1
- Após o build estabilizar, você pode reduzir a memória pra 256 MB no runtime (nginx é leve)

Salvar.

### 5.6 — Implantar

1. Aba **Implantações** → **Implantar**
2. Build leva ~5-7 min na primeira vez (npm install + Vite build + criação da imagem)
3. Status sobe verde 🟢

### 5.7 — Testar no navegador

1. Abra `https://seudominio.tld` em **aba anônima** (Ctrl+Shift+N) — evita cache
2. A tela inicial da aplicação deve aparecer
3. Tente fazer login com as credenciais default (no caso desta app: `admin@cbt.com.br` / `admin123`)

Se o login falha com "Failed to fetch" ou erro de rede, abra o **DevTools (F12)** → aba **Network** → tente login de novo → veja qual URL ele tentou chamar. Se for `localhost:3002`, o `VITE_API_URL` não foi aplicado — refaça **Implantar** (não restart).

Se o login der erro de **CORS** no console, vá pro Apêndice B.

---

## Fase 6 — Migrar o banco de dados

⚠️ **Pule esta fase se for um deploy zerado.**

EasyPanel **não tem** um File Manager para subir arquivos diretamente para o serviço Postgres. A solução é:

1. Subir o dump do seu PC pra VPS via **SCP**
2. Copiar o dump pra dentro do container Postgres com `docker cp`
3. Restaurar com `pg_restore`
4. Validar contagens

### 6.1 — Conectar via SSH na VPS pela primeira vez

No terminal do seu PC:

```bash
ssh root@<IP_VPS>
```

Se a porta SSH for diferente de 22 (verifique no painel Hostinger):
```bash
ssh -p <PORTA> root@<IP_VPS>
```

Na primeira conexão, vai aparecer:
```
The authenticity of host '...' can't be established.
ECDSA key fingerprint is ...
Are you sure you want to continue connecting (yes/no)?
```

Digite `yes` e Enter. Aceita o fingerprint e pede a senha SSH (a do painel Hostinger, **não** a do EasyPanel).

Se conectou, você vê um prompt tipo `root@srv12345:~#`. Sai com `exit`.

> 💡 **Windows sem `ssh`?** Vá em **Configurações → Aplicativos → Recursos opcionais → Adicionar recurso** → procure **"Cliente OpenSSH"** → Instalar.
>
> 💡 **Prefere interface gráfica?** Use o **WinSCP** (https://winscp.net) — ferramenta gratuita, drag-and-drop visual entre seu PC e a VPS, sem precisar lembrar comandos.

### 6.2 — Subir o dump pra VPS via SCP

No terminal do seu PC, no diretório onde está o `cbt_backup.dump`:

```bash
scp cbt_backup.dump root@<IP_VPS>:/root/cbt_backup.dump
```

Se a porta for diferente:
```bash
scp -P <PORTA> cbt_backup.dump root@<IP_VPS>:/root/cbt_backup.dump
```

Vai pedir a senha SSH. A transferência mostra um percentual. Para um dump de 5MB, leva uns 10s. Para 100MB, alguns minutos.

**Confirme que chegou (no terminal do seu PC):**

```bash
ssh root@<IP_VPS> "ls -lh /root/cbt_backup.dump"
```

Deve mostrar o arquivo com seu tamanho. Se mostrar tamanho **0** ou diferente do que você fez upload, refaça o `scp`.

### 6.3 — Identificar o nome real do container Postgres na VPS

EasyPanel usa Docker Swarm internamente, então o nome do container Postgres na VPS tem um sufixo aleatório. Vamos descobrir.

Ainda no SSH da VPS:
```bash
docker ps --format '{{.Names}}' | grep -i postgres
```

Vai retornar algo tipo:
```
cbt_cbt-postgres.1.lxuxbthy2q1yxku3oh9zn7bz5
```

Esse é o nome real. Anote como `<NOME_PG_PROD>`. Vai usar nos próximos comandos.

### 6.4 — Copiar o dump pra dentro do container e restaurar

Tudo dentro do SSH da VPS:

```bash
# 1. Copia o dump do host VPS pra dentro do container Postgres
docker cp /root/cbt_backup.dump <NOME_PG_PROD>:/tmp/cbt_backup.dump

# 2. Confere a assinatura — DEVE mostrar "PGDMP" (sem caracteres estranhos)
docker exec <NOME_PG_PROD> head -c 5 /tmp/cbt_backup.dump
echo
```

Se o `head -c 5` mostrar `PGDMP`, está OK. Se mostrar caracteres estranhos como `��PG`, o dump está corrompido — refaça a Fase 2.2.

```bash
# 3. Roda o pg_restore
docker exec -i <NOME_PG_PROD> pg_restore \
  -U cbt_user \
  -d cbt_portal \
  --no-owner \
  --no-acl \
  -v \
  /tmp/cbt_backup.dump
```

**Explicação dos parâmetros:**
- `-U cbt_user` → usuário no Postgres de produção (definido na Fase 3)
- `-d cbt_portal` → banco onde restaurar
- `--no-owner` → ignora informação de "dono" das tabelas (evita warnings sobre roles que não existem)
- `--no-acl` → ignora ACL (permissões) também
- `-v` → verbose (mostra cada tabela sendo processada)

Vai aparecer várias linhas como:
```
pg_restore: creating TABLE "User"
pg_restore: processing data for table "User"
pg_restore: creating INDEX "...
```

Warnings tipo `WARNING: role "postgres" does not exist` são **normais** com `--no-owner`. Ignore.

Se aparecer um erro como `pg_restore: error: ...` (que não seja warning), me conte para investigar.

### 6.5 — Validar que os dados chegaram

```bash
docker exec -i <NOME_PG_PROD> psql -U cbt_user -d cbt_portal -c '
  SELECT
    (SELECT COUNT(*) FROM "User") AS users,
    (SELECT COUNT(*) FROM "Equipment") AS equipment,
    (SELECT COUNT(*) FROM "HabitualityRecord") AS habit;
'
```

Compare com seu ambiente local — devem bater. Se bater, está tudo certo.

### 6.6 — Aplicar mudanças de schema (se necessário)

Se o backend reclamar de coluna ausente após o restore (porque seu schema atual no código é mais novo que o do dump), abra a aba **Console** do `cbt-backend` no EasyPanel:

```bash
npx prisma db push
```

⚠️ **Sem `--force-reset`** — apenas alinha o schema com o código, **não destrói dados**.

### 6.7 — Limpar o dump por segurança

O dump tem dados pessoais (CPFs, telefones, emails). Apague depois de validar:

```bash
rm /root/cbt_backup.dump
docker exec <NOME_PG_PROD> rm /tmp/cbt_backup.dump
exit  # sai do SSH
```

---

## Fase 7 — Smoke test em produção

Hora de testar tudo de ponta a ponta.

### 7.1 — Abrir em aba anônima

Sempre teste em **aba anônima** (Ctrl+Shift+N no Chrome/Edge, Ctrl+Shift+P no Firefox). Aba normal tem cache de Service Worker, cookies antigos, etc., que mascaram problemas.

### 7.2 — Checklist de validação

Acesse `https://seudominio.tld` e marque:

- [ ] **Tela de login carrega** (sem 502, 503, "site inacessível")
- [ ] **HTTPS funcionando** — cadeado verde no navegador, sem aviso de "conexão não segura"
- [ ] **Login funciona** com `admin@cbt.com.br` / `admin123` (ou suas credenciais)
- [ ] **Dashboard mostra dados reais** (KPIs, contagens batem com o local)
- [ ] **Listagens carregam** (associados, equipamentos, etc.)
- [ ] **Buscar por algum item funciona** (testa filtro/query no banco)
- [ ] **Geração de PDFs funciona** (testa libraries pesadas no frontend)
- [ ] **DevTools (F12) → Network:** todas as chamadas vão para `https://api.seudominio.tld/...` com status 200
- [ ] **EasyPanel → Logs do backend:** sem erros 5xx recorrentes nos últimos minutos
- [ ] **EasyPanel → Logs do frontend:** sem erros do nginx

Se tudo OK, parabéns 🎉 — você terminou o deploy.

---

## Fase 8 — Hardening pós-deploy

Não pule esta fase. Sem ela, seu sistema fica vulnerável.

### 8.1 — Trocar senhas padrão

**Faça AGORA, antes de qualquer outra coisa:**

1. Login como admin no portal
2. Vá em Perfil / Conta / Configurações
3. Trocar senha → mínimo 16 caracteres, com letras maiúsculas, minúsculas, números e símbolos
4. Trocar email de admin se necessário (caso o default seja `admin@cbt.com.br`, mude pro seu email real)

A senha do Postgres já é forte (gerada na Fase 3). Apenas garanta que **NÃO está commitada em arquivo `.env` no repo** (verifique seu `.gitignore`).

### 8.2 — Configurar backup automático do banco

Sem backup, uma falha de hardware = perda total dos dados.

1. EasyPanel → `cbt-postgres` → procure aba **"Backups"** ou **"Snapshots"**
2. Habilite backup diário
3. Idealmente configure destino externo (S3, Backblaze B2, ou outro storage fora da VPS — assim, mesmo que a VPS pegue fogo, você não perde os backups)
4. Anote a frequência e retenção (ex: diário, mantido por 30 dias)

### 8.3 — Verificar HTTPS e HSTS

```bash
curl -I https://seudominio.tld
```

Procure no header retornado:
- `strict-transport-security: ...` → HSTS ativo (browsers forçam HTTPS no futuro)
- `server: nginx/...` → confirma que está servindo

Se HSTS não aparece, é OK — pode ser configurado depois pelo nginx.conf se quiser. Não é bloqueador.

### 8.4 — Monitorar primeiras 24-48h

Os primeiros dias após deploy podem revelar bugs sutis (timezone, encoding, queries lentas). Acompanhe:

- EasyPanel → Logs do backend → procure por `[ERROR]`, `5xx`, exceções
- Logs do frontend → procure por erros do nginx
- Postgres → métricas de CPU/memória (se houver picos estranhos)

Se aparecer padrões estranhos, anote e investigue.

### 8.5 — Documentar o que você tem

Crie ou atualize o `README.md` do repo com:

- URL de produção
- Credenciais admin (em local separado, não no README)
- Como rodar localmente (já existe?)
- Onde estão os backups
- Quem é o responsável (caso saia da equipe)

---

## Apêndice A — Como atualizar coisas depois

### Cenário: Push de código novo

Você fez `git push origin master` com bug fix ou feature nova:

1. EasyPanel detecta automaticamente, mas **não implanta sozinho**
2. Vá em `cbt-backend` (ou `cbt-frontend`, dependendo de qual mudou)
3. Aba **Implantações** → clica **Implantar**
4. Aguarda build (~3-7 min)
5. Container novo sobe, antigo é derrubado, sem downtime

### Cenário: Mudar uma variável do backend (ex: ALLOWED_ORIGINS)

1. EasyPanel → `cbt-backend` → aba **Ambiente**
2. Edita a variável
3. Salva
4. Aba **Implantações** → clica **Reiniciar** (basta restart, não rebuild)
5. Em ~10s o container reinicia com a nova variável

### Cenário: Mudar `VITE_API_URL` ou outra variável de build do frontend

1. EasyPanel → `cbt-frontend` → aba **Ambiente**
2. Edita a variável
3. Salva
4. Aba **Implantações** → clica **Implantar** (precisa rebuild — Vite congela em build time)
5. Aguarda ~5 min

### Cenário: Adicionar um domínio extra (ex: subdomínio para staging)

1. Configura DNS apontando o novo subdomínio para o IP da VPS
2. EasyPanel → serviço respectivo → aba **Domínios** → **+ Adicionar Domínio**
3. Preenche Host, Path, Porta, HTTPS
4. Salva — em ~1-2 min Let's Encrypt emite o cert

### Cenário: Debug em produção

1. EasyPanel → serviço → aba **Console** → entra direto no shell do container
2. Pode rodar `psql`, `node`, `curl localhost:3002/health`, etc.
3. Logs em tempo real: aba **Logs** → marcar "Acompanhar" / "Tail"

---

## Apêndice B — Problemas comuns e soluções

### "API retorna HTML em vez de JSON"

**Sintoma:** `curl https://api.seudominio.tld/health` retorna `<!DOCTYPE html>...` em vez de JSON.

**Causa:** o domínio `api.seudominio.tld` está mal configurado no painel — provavelmente Host com `https://` ou Path com `//`.

**Correção:**
1. EasyPanel → `cbt-backend` → aba **Domínios**
2. Apague a entrada existente
3. **+ Adicionar Domínio** preenchendo CADA campo separado:
   - Host: `api.seudominio.tld` (sem `https://`, sem barra)
   - Path: `/` (uma barra só, não `//`)
   - Porta: `3002`
   - HTTPS: ✓
4. Salvar e aguardar 1-2 min

### "Failed to fetch" no login do navegador

**Sintoma:** login não funciona, DevTools mostra erro de rede.

**Causa A:** `VITE_API_URL` foi colocado como Env Var em vez de propagado como build arg.
**Correção:** garantir que o `Dockerfile` do frontend tem `ARG VITE_API_URL` antes do `RUN npm run build`. Se já tem, fazer **Implantar** (não Restart).

**Causa B:** URL do backend está errada (apontando pra `localhost` ou domínio errado).
**Correção:** Aba Ambiente do frontend → conferir `VITE_API_URL=https://api.seudominio.tld` → Implantar.

### CORS error no console

**Sintoma:** `Access to fetch at 'https://api.X' from origin 'https://Y' has been blocked by CORS policy`.

**Causa:** `ALLOWED_ORIGINS` no backend não inclui o domínio do frontend.

**Correção:**
1. EasyPanel → `cbt-backend` → Ambiente → editar `ALLOWED_ORIGINS`
2. Acrescentar o domínio (separado por vírgula, sem espaço): `https://A,https://B`
3. Salvar → aba Implantações → **Reiniciar**

### Status amarelo "Service is not reachable"

**Sintoma:** serviço fica amarelo, log mostra `SIGQUIT received` ~1 min após start, container reinicia repetidamente.

**Causa:** HEALTHCHECK do Dockerfile falhando (geralmente o `wget --spider` no Alpine tem comportamento inconsistente).

**Correção:** removener o bloco `HEALTHCHECK` do Dockerfile. Deixa o EasyPanel fazer probe HTTP automaticamente via domínio configurado.

### `pg_restore: input file does not appear to be a valid archive`

**Sintoma:** ao restaurar dump, esse erro aparece.

**Causa:** dump foi corrompido na transferência. Quase sempre o causador é o `>` (redirect) do PowerShell/CMD.

**Correção:** regerar o dump usando `-f` em vez de `>` (ver Fase 2.2).

### Build do frontend trava ou OOM

**Sintoma:** build não termina, ou termina com erro de "out of memory".

**Causa:** memória insuficiente (256 MB não basta para Vite + libs pesadas).

**Correção:** aba **Recursos** → memória **1024 MB**. Salva e Implanta de novo.

### Build do backend falha em `prisma generate`

**Sintoma:** erro durante o build do backend mencionando schema.prisma.

**Causa:** o `Dockerfile` está copiando `package.json` e rodando `npm install` (que dispara `prisma generate` via postinstall) **antes** de copiar `prisma/schema.prisma`.

**Correção:** no Dockerfile, use `npm ci --ignore-scripts` para pular o postinstall. Em seguida copie a pasta `prisma/` e rode `npx prisma generate` manualmente.

### Backend log "Can't reach database server"

**Sintoma:** backend não consegue conectar no Postgres.

**Causa:** `DATABASE_URL` com hostname errado.

**Correção:** o hostname interno do Postgres no EasyPanel segue o padrão `<projeto>_<servico>`. Ex: projeto `cbt`, serviço `cbt-postgres` → hostname `cbt_cbt-postgres`. Confirme no painel do Postgres.

### Cadeado vermelho / "Sua conexão não é particular"

**Sintoma:** navegador alerta sobre certificado inválido.

**Causa:** Let's Encrypt ainda não emitiu o cert (DNS pode não ter propagado).

**Correção:** aguarde 5-10 min após `nslookup` confirmar o IP. Se persistir, no EasyPanel → Domínio → procure "Renovar Certificado" ou "Reemitir SSL".

### `ERR_NAME_NOT_RESOLVED` no navegador

**Sintoma:** navegador não acha o domínio.

**Causa:** DNS ainda propagando, ou registro mal configurado.

**Correção:** aguardar até 2h. Testar com `nslookup seudominio.tld` periodicamente. Se 24h depois não resolver, conferir Zona DNS no painel Hostinger.

---

## Apêndice C — Glossário

| Termo | O que significa |
|---|---|
| **VPS** | Virtual Private Server. Computador virtual rodando 24/7 num data center, com IP público. |
| **EasyPanel** | Painel web open-source para gerenciar containers Docker em VPS. Instalado pela Hostinger automaticamente em VPS Ubuntu. |
| **Container Docker** | Aplicação isolada empacotada com tudo que precisa (binários, libs, configs). |
| **Imagem Docker** | "Receita" de um container. Construída via `Dockerfile`. |
| **Dockerfile** | Arquivo de texto que descreve como construir uma imagem Docker (passo a passo). |
| **Reverse Proxy** | Servidor que recebe conexões dos usuários e encaminha para o serviço certo (ex: Traefik, nginx). |
| **Traefik** | Reverse proxy usado pelo EasyPanel. Cuida de roteamento HTTP/HTTPS e Let's Encrypt. |
| **Let's Encrypt** | Autoridade certificadora gratuita que emite certificados HTTPS automaticamente. |
| **DNS** | Sistema que traduz nomes de domínio (`exemplo.com`) em endereços IP. |
| **Registro A** | Tipo de registro DNS que mapeia um nome para um endereço IPv4. |
| **CNAME** | Tipo de registro DNS que aponta um nome para outro nome (alias). |
| **TTL** | Time To Live. Tempo (em segundos) que servidores DNS devem cachear a resposta. |
| **CORS** | Cross-Origin Resource Sharing. Mecanismo de segurança do navegador que controla quais sites podem chamar quais APIs. |
| **JWT** | JSON Web Token. Formato de token usado para autenticação stateless. |
| **Build time vs Runtime** | Build time = quando a imagem Docker é construída. Runtime = quando o container está rodando. Variáveis de Vite são resolvidas em build time; variáveis de Express em runtime. |
| **`pg_dump` / `pg_restore`** | Ferramentas oficiais do Postgres para backup e restauração de bancos. |
| **SCP** | Secure Copy Protocol. Transfere arquivos entre seu PC e a VPS via SSH. |
| **Smoke test** | Teste rápido pós-deploy para verificar que as funcionalidades principais estão OK. |

---

## Encerramento

Esse tutorial cobre o caminho completo do "VPS recém-contratada" até "aplicação em produção com HTTPS". Se algo travar em qualquer passo, releia o capítulo correspondente — geralmente o erro é uma questão de detalhe (Path com barra dupla, variável em aba errada, etc.) que o Apêndice B aborda.

Boa sorte com o deploy. 🚀
