# TabelaFin — Documento de Escopo (rascunho v0.1)

> App de finanças pessoais que puxa sozinho os dados do Nubank (conta +
> cartão) e da XP (conta digital + investimentos) via Open Finance, categoriza
> gastos com IA e gera um relatório mensal de onde dá pra melhorar. Serviço
> **hospedado** (não self-hosted), open source, com o usuário trazendo suas
> próprias credenciais (IA + Open Finance). Upload de PDF de fatura/extrato
> existe só como fallback manual, não como fluxo principal.

## 1. Problema

Controle manual de gasto exige lançar cada transação à mão — fricção grande
demais pro dia a dia. O Ian quer que o app puxe os dados sozinho (Nubank +
XP), categorize com IA e mostre, no fim do mês, onde dá pra melhorar — sem
precisar digitar nada.

## 2. Modelo de negócio/hospedagem — decisões-chave

### 2.1 Hospedado, não self-hosted

**Decisão:** o TabelaFin roda como **serviço hospedado** — um Cloudflare
Worker central serve UI, API e dados. Mesma decisão do
[TabelaCal](https://github.com/TabelaDev/tabelacal): self-host cria fricção de
setup que não compensa, mesmo o público inicial sendo só o Ian.

### 2.2 BYOK para a IA

Cada usuário cola sua **própria API key de LLM** (Anthropic/OpenAI) e escolhe
o **modelo**. Usada tanto pra categorizar transações quanto pra extrair dados
de PDF (seção 2.4). O usuário paga sua própria inferência; sem custo
compartilhado. Reaproveita **exatamente** o padrão já em produção no
TabelaCal (`src/lib/ai-providers.ts`, `src/lib/server/ai/parse.ts`).

### 2.3 Open Finance: BYO Meu Pluggy (padrão inspirado no BYO Google OAuth Client do TabelaCal)

**A parte mais importante do design**, análoga à decisão do OAuth Client no
TabelaCal: em vez de o TabelaFin ter uma conta Pluggy comercial paga
compartilhada por todo mundo (planos a partir de R$2.500/mês), **cada usuário
traz sua própria conexão**:

1. Usuário cria conta no [Meu Pluggy](https://www.pluggy.ai/meu-pluggy) —
   gratuito por tempo indeterminado pra uso pessoal.
2. Conecta suas próprias contas (mesmo CPF) — Nubank e XP — via Open Finance,
   dentro da própria UI do Meu Pluggy.
3. Gera um **Client ID + Client Secret** ali mesmo.
4. Cola essas credenciais no onboarding do TabelaFin.
5. O TabelaFin usa essas credenciais (armazenadas criptografadas, mesmo
   padrão de envelope encryption do TabelaCal) pra chamar a API da Pluggy e
   sincronizar contas, transações e investimentos **daquele usuário
   especificamente**.

Cobertura confirmada: contas/cartão e um produto de **Investments** dedicado
que inclui XP/XP Wealth.

**Zona cinzenta identificada, não bloqueante:** os termos do Meu Pluggy dizem
"uso comercial exige plano pago" mas não definem o que conta como comercial.
Pra uso pessoal (só o Ian, sua própria conta) isso não é um problema — é
literalmente o caso de uso anunciado. Só vira pergunta real se o app abrir
pra outras pessoas usarem (confirmar com o suporte da Pluggy antes, ver
seção 4 "Fora de escopo").

**Trade-off aceito:** onboarding com mais um passo manual (criar conta no Meu
Pluggy) em vez de "conectar direto". Precisa de wizard guiado, mesmo estilo
do wizard de GCP do TabelaCal.

### 2.4 Ingestão de PDF (fallback): manda o arquivo direto pro modelo do usuário

**Decisão:** não usar lib de extração de texto (pdf-parse/pdfjs-dist) nem
parsing client-side. O PDF (base64) é enviado direto pra API do modelo que o
usuário escolheu, usando suporte nativo de "document understanding" (bloco
`document` da Claude Messages API; input de arquivo na OpenAI), pedindo
extração + categorização estruturada num único request — mesmo formato de
tool-use/structured-output que o TabelaCal já usa pra transformar linguagem
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

A partir daí, o TabelaFin cuida de tudo: sync, categorização, relatório,
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
   o código de Web Push já validado no TabelaCal pros lembretes de evento.
   E-mail fica fora do MVP (sem infra de e-mail ainda).

## 4. Escopo

### MVP (v1)

- Onboarding: IA (chave + modelo) — reaproveitar componente do TabelaCal.
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

Reaproveita o padrão de envelope encryption do TabelaCal (`MASTER_KEY`
AES-GCM via WebCrypto, nonce separado por segredo).

```
users                 (id, email, timezone, default_currency, created_at)

ai_credentials         -- BYOK de IA, reaproveitado do TabelaCal sem mudança de forma
  user_id, provider, model, key_encrypted, nonce

pluggy_credentials     -- Client ID/Secret DO PRÓPRIO usuário (seção 2.3)
  user_id, client_id_encrypted, client_id_nonce, client_secret_encrypted,
  client_secret_nonce, created_at

pluggy_items           -- 1 Client ID/Secret pode conectar múltiplos logins bancários
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
   padrão do TabelaCal).
3. ✅ **Open Finance**: BYO Meu Pluggy por usuário (não conta Pluggy
   comercial centralizada) — evita custo compartilhado e mantém uso 100%
   gratuito.
4. ✅ **PDF**: enviado direto pro modelo do usuário (document understanding),
   sem lib de parsing, com capability gating por modelo.
5. ✅ **Categorização**: em lote na ingestão, nunca por transação isolada nem
   recorrente a cada view do dashboard.
6. ✅ **Sync**: cron diário (Pluggy) + cron mensal (relatório + push),
   reaproveitando o handler `scheduled` já existente no TabelaCal.
7. ⬜ Formato exato do wizard de onboarding do Meu Pluggy (quantas telas, que
   nível de hand-holding visual) — a definir na Fase de UI.
8. ⬜ Confirmar com a Pluggy a situação de ToS caso o app seja aberto pra
   outros usuários no futuro (não bloqueia o MVP pessoal).

## 7. Licença e modelo open source

- **AGPL-3.0**, mesma escolha da família Tabela* — copyleft de rede,
  coerente com ser serviço hospedado (não lib redistribuída).
- **Releases**: GitHub Releases via tag (`vX.Y.Z`), changelog em
  `CHANGELOG.md` (formato [Keep a Changelog](https://keepachangelog.com/)).
- **Contribuição**: ver `CONTRIBUTING.md`.
