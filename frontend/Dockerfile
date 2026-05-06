# =====================================================
# Portal CBT — Frontend (Vite + React + nginx)
# Multi-stage build:
#   1. builder — node:22 instala deps e roda `npm run build` (Vite gera dist/)
#   2. runner  — nginx:alpine serve dist/ + SPA fallback
#
# IMPORTANTE: VITE_API_URL eh injetado em BUILD time (npm run build),
# nao em runtime. EasyPanel precisa passar como Build Arg, nao Env Var.
# =====================================================

FROM node:22-slim AS builder
WORKDIR /app

# Build arg recebido pelo EasyPanel/docker build com --build-arg
ARG VITE_API_URL=http://localhost:3002
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# =====================================================

FROM nginx:alpine AS runner

# Substitui a config default do nginx pela nossa (SPA fallback + cache)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia o build estatico
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Sem HEALTHCHECK aqui — o EasyPanel define o proprio probe HTTP
# baseado no dominio configurado no painel. HEALTHCHECK do Docker
# usando wget --spider pode falhar em alguns ambientes mesmo com
# nginx funcionando, derrubando o container desnecessariamente.

CMD ["nginx", "-g", "daemon off;"]
