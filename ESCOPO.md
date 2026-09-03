# TAbelhaFin — Documento de Escopo (rascunho v0.1)

> App de finanças pessoais que puxa sozinho os dados do Nubank (conta +
> cartão) e da XP (conta digital + investimentos) via Open Finance, categoriza
> gastos com IA e gera um relatório mensal de onde dá pra melhorar. Serviço
> **hospedado** (não self-hosted), open source, com o usuário trazendo suas
> próprias credenciais (IA + Open Finance). Upload de PDF de fatura/extrato
> existe só como fallback manual, não como fluxo principal.

## Status de implementação (2026-08-03)

O scaffold e todo o MVP (seção 4) já foram implementados — 8 commits locais na
`main`, ainda **não pushados** pro GitHub. Resumo pra continuar em outra
sessão:

### ✅ Implementado e validado (`bun run check/lint/test/build` passam)

- Scaffold SvelteKit + Cloudflare Workers (adapter, PWA, worker com cron),
  Drizzle/D1 com o schema completo da seção 5.
- **Login**: como o TAbelhaFin não usa nenhuma API do Google, o login **não**
  é OAuth (diferente do TAbelhaCal) — é um token compartilhado (`LOGIN_TOKEN`
  secret) que autentica um único usuário fixo (`OWNER_EMAIL`). Decisão nova,
  não estava documentada neste ESCOPO originalmente — pragmática porque o app
  é de uso pessoal único por enquanto (ver "Fora de escopo" abaixo). Ver
  `src/lib/server/auth.ts`, `src/routes/login/`.
- **Onboarding de IA** (`src/routes/onboarding/ai/`): form real, grava
  `ai_credentials` cifrado.
- **Onboarding de Open Finance** (`src/routes/onboarding/pluggy/`): paste de
  Client ID/Secret do Meu Pluggy + Pluggy Connect Widget (via CDN,
  `src/lib/components/PluggyConnect.svelte`) pra conectar Nubank/XP de verdade.
- **Cliente Pluggy** (`src/lib/server/pluggy/client.ts`): fetch-based, sem
  SDK. Endpoints confirmados via WebFetch contra docs.pluggy.ai + o repo
  oficial `pluggyai/quickstart` — não só conhecimento de treino.
- **Sync diário** (`src/lib/server/pluggy/sync.ts`, cron `0 6 * * *`):
  accounts + transactions (janela de 35 dias) + investments, com o dedupe/
  supersede da seção 5.
- **Categorização em lote via IA** (`src/lib/server/ai/categorize.ts`): 1
  chamada por usuário no fim de cada sync, nunca por transação.
- **Relatório mensal + push** (`src/lib/server/reports/generate.ts`, cron
  `0 7 1 * *`): narrativa via IA, comparação mês a mês, notificação Web Push
  quando fica pronto (`src/lib/components/PushSubscribe.svelte`).
- **Upload de PDF como fallback** (seção 2.4): `src/lib/server/ai/extract.ts`
  manda o PDF (base64) direto pro modelo do usuário via document understanding
  (bloco `document` da Anthropic / `input_file` da OpenAI, formatos confirmados
  contra a doc oficial) e extrai + categoriza num único request (tool-use
  estruturado). Rota `POST /api/statement-upload` valida o PDF, grava em
  `statement_uploads` e insere as transações com `source='pdf_upload'` e
  `categorySource='ai'` — o arquivo é descartado (sem R2). Gating por
  `supportsDocuments` desabilita o upload na UI (`src/lib/components/StatementUpload.svelte`)
  quando o modelo escolhido não suporta documentos.
- **Dashboard** (`src/routes/dashboard/`): contas, transações com categoria,
  relatório mais recente, upload de PDF.

### ⬜ Ainda não implementado

Nada resta do MVP (seção 4). Fora do MVP, seguem de pé os itens da seção 4
"v2" e "Fora de escopo" (e-mail, insights mais profundos, outros bancos,
metas de orçamento, abrir o app pra outros usuários).

### ✅ Pontos `TODO(pluggy-verify)` resolvidos (2026-08-03)

Os três pontos que a doc pública não tinha fechado em 2026-08-01 foram
re-conferidos contra as docs atuais e resolvidos no código:

- **Enum de `status` de item**: confirmado completo em
  `docs.pluggy.ai/docs/item-lifecycle` — UPDATED/UPDATING/LOGIN_ERROR/OUTDATED/
  WAITING_USER_INPUT. Os dois últimos (antes suposição histórica) estão certos
  e o comentário de `fetchItem` foi atualizado.
- **`GET /transactions` (deprecated)** → **`GET /v2/transactions`**: migrado
  no `fetchTransactions` (client.ts). Formato do cursor confirmado no OpenAPI
  de `docs.pluggy.ai/reference/transactions-list-by-cursor`: a resposta traz
  `results` + `next` (query string completa da próxima página, inclui o cursor
  `after`; `null` quando acaba), filtros de data `dateFrom`/`dateTo`.
- **Widget Pluggy Connect**: CDN subiu de v2.8.2 → **v2.11.0**, a build
  versionada mais recente confirmada em `cdn.pluggy.ai` (`latest` aponta pro
  mesmo bundle; a npm 2.14.1 ainda não tem build no CDN). API do widget
  conferida contra os typings de `pluggy-connect-sdk@2.11.0`.

O que falta agora não é mais dúvida de código, e sim o **teste ponta a ponta
com uma conta Meu Pluggy real** (conectar via widget, rodar o sync e conferir
os dados batendo com a conta do Ian).

### Recursos Cloudflare já criados (conta real, não placeholder)

D1 `tabelhafin-db` (`08a3cf81-b376-41ab-b41d-21a0778f3257`), KV `SESSIONS`
(`34086589c9b34c1ab5c5b59e236662f0`), par VAPID novo. Segredos
(`MASTER_KEY`, `LOGIN_TOKEN`, `VAPID_PRIVATE_KEY`) só em `.dev.vars` local,
nunca commitados — `wrangler secret put` ainda não foi rodado em produção
(o Worker em si também ainda não foi deployado, só os recursos D1/KV).

## 1. Problema

Controle manual de gasto exige lançar cada transação à mão — fricção grande
demais pro dia a dia. O Ian quer que o app puxe os dados sozinho (Nubank +
XP), categorize com IA e mostre, no fim do mês, onde dá pra melhorar — sem
precisar digitar nada.

## 2. Modelo de negócio/hospedagem — decisões-chave

### 2.1 Hospedado, não self-hosted

**Decisão:** o TAbelhaFin roda como **serviço hospedado** — um Cloudflare
Worker central serve UI, API e dados. Mesma decisão do
[TAbelhaCal](https://github.com/TAbelhaDev/tabelacal): self-host cria fricção de
setup que não compensa, mesmo o público inicial sendo só o Ian.

### 2.2 BYOK para a IA

Cada usuário cola sua **própria API key de LLM** (Anthropic/OpenAI) e escolhe
o **modelo**. Usada tanto pra categorizar transações quanto pra extrair dados
de PDF (seção 2.4). O usuário paga sua própria inferência; sem custo
compartilhado. Reaproveita **exatamente** o padrão já em produção no
TAbelhaCal (`src/lib/lib/ai-providers.ts`, `src/lib/server/ai/parse.ts`).

### 2.3 Open Finance: BYO Meu Pluggy (API interna, sem plano comercial)

**A parte mais importante do design**: em vez de o TAbelhaFin ter uma conta
Pluggy comercial paga compartilhada por todo mundo (planos a partir de
R$2.500/mês), **cada usuário traz sua própria conexão** via a API interna do
Meu Pluggy (`my-api.pluggy.ai`), que é gratuita pra uso pessoal:

1. Usuário cria conta no [Meu Pluggy](https://www.pluggy.ai/meu-pluggy) —
   gratuito por tempo indeterminado pra uso pessoal.
2. Conecta suas próprias contas (mesmo CPF) — Nubank e XP — via Open Finance,
   dentro da própria UI do Meu Pluggy.
3. Faz login em meu.pluggy.ai e copia o **JWT access token** (via DevTools:
   Network > qualquer chamada a `my-api.pluggy.ai` > header `Authorization`).
4. Cola o token no onboarding do TAbelhaFin.
5. O TAbelhaFin usa o token (armazenado criptografado com `MASTER_KEY`) pra
   chamar a API interna do Meu Pluggy e sincronizar contas, transações e
   investimentos **daquele usuário especificamente**.

**Por que a API interna em vez da API comercial:** a API comercial
(`api.pluggy.ai`) exige Client ID/Secret que só funcionam com plano pago
(R$2.500/mês) ou demo app (sandbox only, sem item creation). A API interna
(`my-api.pluggy.ai`) usa JWT (Auth0) e é a mesma que o portal do Meu Pluggy
usa — gratuita, sem restrição de plano.

Cobertura confirmada: contas/cartão e um produto de **Investments** dedicado
que inclui XP/XP Wealth.

**Trade-off: token de curta duração (~24h).** O JWT access token expira em
aproximadamente 24 horas. O sync diário (cron 6h) funciona se o usuário
autenticou no máximo ~18h antes. Quando o token expira, o usuário precisa
re-autenticar (copiar novo token do DevTools). Uma melhoria futura seria usar
o refresh token do Auth0 pra renovar automaticamente.

### 2.4 Ingestão de PDF (fallback): manda o arquivo direto pro modelo do usuário

**Decisão:** não usar lib de extração de texto (pdf-parse/pdfjs-dist) nem
parsing client-side. O PDF (base64) é enviado direto pra API do modelo que o
usuário escolheu, usando suporte nativo de "document understanding" (bloco
`document` da Claude Messages API; input de arquivo na OpenAI), pedindo
extração + categorização estruturada num único request — mesmo formato de
tool-use/structured-output que o TAbelhaCal já usa pra transformar linguagem
natural em JSON de evento.

**Por quê:** extração via texto reconstruído exigiria heurística de layout
por tipo de documento (fatura Nubank ≠ extrato Nubank ≠ nota XP), frágil a
mudança de layout, e ainda precisaria de uma chamada de IA depois pra
estruturar. Mandar o PDF direto elimina essa camada inteira e zera o risco de
compatibilidade com o `workerd` (nenhuma lib de parsing roda no Worker).

**Trade-off aceito, resolvido por capability gating (não fallback
silencioso):** nem todo modelo do dropdown de IA suporta input de documento
(ex.: DeepSeek não suporta; Claude Sonnet/Opus e GPT-4o+/5-family suportam).
Um flag `supportsDocuments` por modelo em `ai-providers.ts` desabilita o
upload de PDF na UI com mensagem explícita quando o modelo escolhido não
suporta, em vez de trocar de modelo por baixo dos panos — BYOK significa o
usuário controla custo/provedor.

### 2.5 Resumo do cadastro do usuário

Antes de usar o app, o usuário completa 2 cadastros independentes:

- **IA**: chave de API + modelo escolhido.
- **Open Finance**: Client ID + Client Secret do próprio Meu Pluggy dele →
  conecta Nubank + XP.

A partir daí, o TAbelhaFin cuida de tudo: sync, categorização, relatório,
hosting.

## 3. Fluxos / UX

1. **Onboarding**: wizard com 2 etapas — configurar IA (colar key + escolher
   modelo) e configurar Open Finance (wizard guiado de criação de conta no Meu
   Pluggy + colar Client ID/Secret).
2. **Sync automático**: cron diário puxa accounts/transactions/investments
   via Pluggy; botão de "atualizar agora" pra refresh manual.
3. **Categorização**: uma chamada de IA em lote por sync/upload, categorizando
   todas as transações novas/não categorizadas de uma vez — nunca uma chamada
   por transação, nunca recategorização a cada view do dashboard. Transações
   corrigidas manualmente pelo usuário (`category_source='user'`) nunca são
   re-categorizadas por rodadas futuras.
4. **Upload de PDF (fallback)**: extração + categorização acontecem no mesmo
   request (seção 2.4), sem chamada extra.
5. **Dashboard mensal**: gastos por categoria, comparação mês a mês, saldo de
   investimentos.
6. **Relatório mensal automático**: cron no dia 1 gera o relatório do mês
   anterior e dispara notificação push avisando que está pronto — reaproveita
   o código de Web Push já validado no TAbelhaCal pros lembretes de evento.
   E-mail fica fora do MVP (sem infra de e-mail ainda).

## 4. Escopo

### MVP (v1)

- Onboarding: IA (chave + modelo) — reaproveitar componente do TAbelhaCal.
- Onboarding: wizard guiado de conexão Meu Pluggy.
- Sync automático via Pluggy: conta/cartão + investimentos XP.
- Upload de PDF como fallback, com capability gating por modelo.
- Categorização via IA em lote.
- Dashboard mensal (categoria, comparação mês a mês, saldo de investimentos).
- Cron diário de sync + cron mensal de relatório com notificação push.
- PWA instalável (`@vite-pwa/sveltekit`).

### v2

- Envio de resumo por e-mail (não só push).
- Insights mais profundos ("onde economizar" via IA, além da categorização).
- Outros bancos além de Nubank/XP (qualquer coisa que a Pluggy cubra).
- Metas de orçamento / alertas de limite de gasto.

### Fora de escopo (por enquanto)

- Conta Pluggy comercial paga centralizada (decisão da seção 2.3 evita isso
  deliberadamente).
- Abrir o app pra outros usuários usarem — antes disso, confirmar com o
  suporte da Pluggy se o modelo BYOK de Meu Pluggy (cada usuário orquestrando
  sua própria credencial dentro de um app de terceiro) ainda conta como uso
  pessoal ou passa a exigir plano comercial.
- Persistir o PDF enviado (sem R2 no MVP) — extrai, guarda as transações
  estruturadas, descarta o arquivo.

## 5. Modelo de dados (Drizzle + D1) — proposta

Reaproveita o padrão de envelope encryption do TAbelhaCal (`MASTER_KEY`
AES-GCM via WebCrypto, nonce separado por segredo).

```
users                 (id, email, timezone, default_currency, created_at)

ai_credentials         -- BYOK de IA, reaproveitado do TAbelhaCal sem mudança de forma
  user_id, provider, model, key_encrypted, nonce

pluggy_credentials     -- JWT access token do Meu Pluggy (seção 2.3)
  user_id, token_encrypted, token_nonce, created_at

pluggy_items           -- 1 token pode ter múltiplas conexões bancárias
  id, user_id, pluggy_item_id, institution_name, institution_type, status,
  last_synced_at

accounts               -- contas puxadas da Pluggy
  id, user_id, pluggy_item_id, pluggy_account_id, institution,
  type ('checking'|'credit_card'|'investment'), name, currency, cached_balance

transactions           -- unificada: Pluggy e PDF
  id, user_id, account_id, pluggy_transaction_id, statement_upload_id,
  date, description, amount, currency,
  source ('pluggy'|'pdf_upload'), category, category_source ('ai'|'user'),
  dedupe_hash, superseded_by_transaction_id

statement_uploads      -- uploads de PDF (fallback)
  id, user_id, filename, status ('pending'|'processing'|'completed'|'failed'),
  error_message, transaction_count, created_at

monthly_reports        -- relatório mensal (cache)
  id, user_id, year_month, summary_json, model_used, generated_at
```

Regra de dedupe: quando uma sync da Pluggy trouxer uma transação que já
existia via PDF (mesma conta/valor/data ±3 dias), a linha do PDF é marcada
como `superseded_by_transaction_id` em vez de apagada (mantém auditoria); toda
query de dashboard/relatório filtra `superseded_by_transaction_id IS NULL`.

- **KV:** sessões (cookie → user_id).
- **Worker secret `MASTER_KEY`:** AES-GCM (WebCrypto) para envelope encryption
  de `ai_credentials`, `pluggy_credentials` e campos sensíveis. Nunca logar
  chaves/segredos/tokens.

## 6. Decisões

1. ✅ **Hospedagem**: serviço hospedado central (Cloudflare Workers), não
   self-hosted.
2. ✅ **IA**: BYOK — chave própria do usuário + escolha de modelo (mesmo
   padrão do TAbelhaCal).
3. ✅ **Open Finance**: BYO Meu Pluggy por usuário (não conta Pluggy
   comercial centralizada) — evita custo compartilhado e mantém uso 100%
   gratuito.
4. ✅ **PDF**: enviado direto pro modelo do usuário (document understanding),
   sem lib de parsing, com capability gating por modelo.
5. ✅ **Categorização**: em lote na ingestão, nunca por transação isolada nem
   recorrente a cada view do dashboard.
6. ✅ **Sync**: cron diário (Pluggy) + cron mensal (relatório + push),
   reaproveitando o handler `scheduled` já existente no TAbelhaCal.
7. ⬜ Formato exato do wizard de onboarding do Meu Pluggy (quantas telas, que
   nível de hand-holding visual) — a definir na Fase de UI.
8. ⬜ Confirmar com a Pluggy a situação de ToS caso o app seja aberto pra
   outros usuários no futuro (não bloqueia o MVP pessoal).

## 7. Licença e modelo open source

- **AGPL-3.0**, mesma escolha da família Tabela* — copyleft de rede,
  coerente com ser serviço hospedado (não lib redistribuída).
- **Releases**: GitHub Releases via tag (`vX.Y.Z`), changelog em
  `CHANGELOG.md` (formato [Keep a Changelog](https://keepachangelog.com/)).
