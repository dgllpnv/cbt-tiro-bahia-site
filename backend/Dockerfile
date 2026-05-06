# =====================================================
# Portal CBT — Backend (Express + Prisma + tsx)
# Multi-stage build:
#   1. deps   — instala node_modules + gera Prisma Client
#   2. runner — imagem final com app pronto para rodar
#
# Usa tsx em runtime (sem etapa de tsc), igual ao dev.
# =====================================================

FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
# --ignore-scripts pula o postinstall (prisma generate), que precisa
# do schema.prisma — copiado em seguida.
RUN npm ci --ignore-scripts
COPY prisma ./prisma/
RUN npx prisma generate

FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Producao: NODE_ENV controla logs verbosos, comportamento de erros, etc.
ENV NODE_ENV=production
ENV PORT=3002

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# tsx executa TS direto (sem compilar). Mesmo runtime do dev,
# mas sem watch — ideal para producao.
CMD ["npm", "run", "start:prod"]
