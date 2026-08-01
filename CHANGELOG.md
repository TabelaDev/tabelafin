# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
este projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added

- Documento de escopo (`ESCOPO.md`), com seção de status de implementação
  mantida atualizada a cada marco.
- Scaffold do projeto: SvelteKit + Cloudflare Workers (D1 + KV), Drizzle com o
  schema de dados completo, sessão via KV, envelope encryption (AES-GCM) pras
  credenciais de IA e do Meu Pluggy, dropdown de providers de IA com gating de
  suporte a documento, PWA instalável, cron diário (sync) + mensal (relatório).
- Estrutura inicial do repositório open source (licença AGPL-3.0, templates de
  issue/PR, workflows de CI e release).
- Recursos Cloudflare reais (D1 `tabelafin-db`, KV `SESSIONS`, par VAPID).
- Login de usuário único via token compartilhado (sem OAuth do Google — o
  TabelaFin não usa nenhuma API do Google), onboarding de credenciais de IA e
  dashboard protegido inicial.
- Integração real com a Pluggy: cliente REST fetch-based, onboarding com
  paste de Client ID/Secret + Pluggy Connect Widget, sync diário de
  accounts/transactions/investments com a regra de dedupe/supersede da
  seção 5 do `ESCOPO.md`.
- Categorização em lote das transações via IA (uma chamada por usuário por
  sync, nunca por transação).
- Relatório mensal com narrativa via IA, comparação mês a mês e notificação
  push de "relatório pronto".

### Pendente (ver "Status de implementação" no `ESCOPO.md`)

- Upload de PDF como fallback (único item do MVP ainda não implementado).
- Confirmar contra uma conta Meu Pluggy real os pontos marcados
  `TODO(pluggy-verify)` no código (enum de status de item, migração pra
  `GET /v2/transactions`, versão do CDN do Connect Widget).
