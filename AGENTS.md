# tabelafin — contexto essencial

App de finanças pessoais (Open Finance + categorização por IA, BYOK). Repo **aberto**,
AGPL-3.0. Antes de mexer, leia o `README.md` (produto) e o `CONTRIBUTING.md` (política de
linguagem de toda a TabelaDev).

## Stack

- **SvelteKit + TypeScript**, adaptador Cloudflare Workers. A config do SvelteKit fica
  **dentro do `vite.config.ts`** (não há `svelte.config.js`).
- **Banco:** Cloudflare D1 (binding `DB`) via **Drizzle ORM**. Schema num arquivo só:
  `src/lib/server/db/schema.ts`. Um módulo de acesso por tabela em `src/lib/server/db/`.
- **Sessões:** KV (binding `SESSIONS`). **Auth:** better-auth, montado em
  `/api/auth/[...all]`; o módulo reaproveitável fica em `src/lib/auth/` (tem README próprio).
- **Cron:** `worker/entry.js` embrulha o worker gerado pra expor o handler `scheduled` —
  sync diário do Pluggy (`0 6 * * *`) e relatório mensal (`0 7 1 * *`). Por isso existem
  **dois** wrangler configs: `wrangler.jsonc` (real) e `wrangler.adapter.jsonc` (só pro
  adapter não sobrescrever o `entry.js`).
- **UI:** `@tabeladev/tabelawebui` (registry). Tailwind v4, um único stylesheet em
  `src/routes/layout.css`. Sem shadcn.
- **PWA:** `@vite-pwa/sveltekit` + `src/lib/ReloadPrompt.svelte`.

## Rodando dev

Um terminal só — o adapter expõe os bindings no `vite dev`:

```
bun dev
```

A porta sai de `~/.config/dev-ports.yaml` (chaveada pelo cwd), com fallback `DEV_PORT`.

## Comandos

`bun dev`, `bun run check`, `bun run lint`, `bun run format`, `bun run test` (vitest),
`bun run test:e2e` (playwright), `bun run build`, `bun run deploy`.
Banco: `bun run db:generate` / `db:migrate` / `db:studio`.

Antes de abrir PR: `bun run check && bun run lint && bun run test && bun run build`.

## Rotas

- `(marketing)/` — público. O header/nav mora no `+layout.svelte` do grupo, nunca dentro
  da página. A landing redireciona quem já tem sessão pra `/dashboard`.
- `(app)/` — logado. Guard único em `(app)/+layout.server.ts`.
- `login/`, `signup/`, `logout/` — soltas na raiz (o TabelaRPGDK usa `auth/`; ver a
  convenção compartilhada).
- `api/` — endpoints JSON/binários (chat, upload, push, onboarding, auth). Mutação de
  tela é **form action**, não fetch pra `/api`.

## Testes

`*.spec.ts` colocado ao lado do módulo (vitest, ambiente node). E2E em `e2e/` (playwright).

## Convenções compartilhadas

Regras comuns aos apps web da TabelaDev (grupos de rota, tokens de tema, landing, SEO):
`docs/convencoes-web.md` no repo do
[tabelawebui](https://github.com/TabelaDev/tabelawebui). Não duplicar as regras aqui.

## Cuidado com docs desatualizados

`ESCOPO.md` é o doc de produto e continua válido no geral, mas **duas partes estão
obsoletas**: descreve login por `LOGIN_TOKEN` de usuário único (hoje é better-auth com
e-mail/senha) e rotas `src/routes/onboarding/*` (hoje o onboarding é modal +
`/api/onboarding/*`).
