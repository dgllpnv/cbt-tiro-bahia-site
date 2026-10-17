#!/bin/sh
# =====================================================
# Portal CBT — inicia o nginx do frontend
#
# Por que este script existe (incidente de 17/10/2026):
# O EasyPanel cria o servico com restart policy "on-failure", ou seja,
# o Docker so recria o container se ele terminar com codigo de ERRO.
# Quando a Hostinger desligou a VPS, o nginx encerrou "com sucesso"
# (codigo 0), o Docker considerou o trabalho concluido e NAO subiu o
# frontend de volta — o site ficou ~3h fora ate um redeploy manual.
#
# Aqui o nginx roda normalmente, mas este script SEMPRE termina com
# codigo diferente de zero. Assim, depois de qualquer desligamento ou
# reboot da VPS, o Docker sobe o frontend de novo sozinho.
# Em deploys normais nada muda: o EasyPanel troca o container de
# proposito e nao tenta reiniciar o antigo.
# =====================================================

nginx -g 'daemon off;' &
pid=$!

# O Docker para o nginx:alpine com SIGQUIT (STOPSIGNAL da imagem);
# TERM/INT cobrem outros cenarios. Repassa o pedido ao nginx
# (encerramento gracioso) e sai com 143 (= encerrado por sinal).
trap 'kill -QUIT "$pid" 2>/dev/null; wait "$pid"; exit 143' QUIT TERM INT

wait "$pid"
# nginx morreu sozinho (falha) — tambem sai com erro para ser recriado
exit 1
