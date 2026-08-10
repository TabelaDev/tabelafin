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
- Integração com o Meu Pluggy via API interna (`my-api.pluggy.ai`): cliente
  REST fetch-based, onboarding com paste de JWT access token (obtido via
  DevTools no meu.pluggy.ai), sync diário de accounts/transactions/investments
  com a regra de dedupe/supersede da seção 5 do `ESCOPO.md`. Não usa a API
  comercial da Pluggy (`api.pluggy.ai`) nem o Pluggy Connect Widget — a API
  interna do Meu Pluggy é gratuita pra uso pessoal, sem necessidade de plano
  comercial (R$2.500/mês).
- Categorização em lote das transações via IA (uma chamada por usuário por
  sync, nunca por transação).
- Relatório mensal com narrativa via IA, comparação mês a mês e notificação
  push de "relatório pronto".
- Upload de PDF de fatura/extrato como fallback manual: o arquivo é enviado
  direto pro modelo de IA do usuário (document understanding da Anthropic /
  OpenAI, formatos confirmados contra a doc oficial) e extração + categorização
  acontecem num único request estruturado, sem lib de parsing. Persiste só as
  transações extraídas (`source='pdf_upload'`) e descarta o PDF. Capability
  gating por modelo desabilita o upload na UI quando não há suporte a
  documentos.
- Pontos `TODO(pluggy-verify)` resolvidos: enum de `status` de item confirmado
  completo na doc (inclui OUTDATED e WAITING_USER_INPUT), sync migrado de
  `GET /transactions` (deprecated, remoção após 2026-12-31) pra
  `GET /v2/transactions` com paginação por cursor (formato do cursor
  confirmado no OpenAPI), e widget Pluggy Connect atualizado de v2.8.2 pra
  v2.11.0 no CDN.

### Pendente

- Token JWT de curta duração (~24h): implementar refresh automático via refresh
  token do Auth0 pra evitar re-autenticação manual diária.
- Teste ponta a ponta com dados reais do Meu Pluggy (o token do Ian já foi
  validado contra a API, falta rodar o sync completo e conferir o dashboard).
