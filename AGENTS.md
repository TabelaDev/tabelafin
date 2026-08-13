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
- **PWA:** `@vite-pwa/sveltekit` + `src/lib/components/ReloadPrompt.svelte`.
- **Layout de `src/lib/`:** `components/` (.svelte), `stores/` (svelte/store),
  `lib/` (utils compartilhados client+server), `client/` (só-browser). Server-only
  sempre em `server/`. Não criar arquivo novo na raiz do `src/lib/`.

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

## Staging (homologação)

Dois ambientes no Cloudflare Workers, via environments do wrangler: `tabelafin`
(prod, `tabelafin.ianptkcs-023.workers.dev`) e `tabelafin-staging`
(`tabelafin-staging.ianptkcs-023.workers.dev`). Recursos **isolados**: D1
`tabelafin-db-staging` + KV `SESSIONS_STAGING`, nunca compartilham banco/sessão
com prod. O build do SvelteKit é env-agnóstico (URL vem de var em runtime), então
`bun run build` gera o mesmo bundle pra ambos.

Runbook de implantação do staging (feito uma vez, depois vira só o deploy):

1. Criar recursos (anotar os ids de saída):
   `wrangler d1 create tabelafin-db-staging`
   `wrangler kv namespace create SESSIONS_STAGING`
2. No `wrangler.jsonc`, adicionar o bloco `env.staging` (nome, vars apontando pro
   subdomínio de staging, D1/KV criados acima). Atenção: environments **herdam**
   `triggers.crons` do top-level — pra staging ficar sem cron, declarar
   `"triggers": { "crons": [] }` no bloco (o wrangler tenta registrar os crons
   herdados mesmo sem você pedir, e o limite do plano Free é 5 por conta).
   Rodar `bun run check` depois: o `wrangler types` regenera
   `worker-configuration.d.ts`, e se o hash mudar, commitar o arquivo novo.
3. Migrações: `wrangler d1 migrations apply tabelafin-db-staging --remote --env staging`
   (sem `--env staging` o wrangler não acha o banco — ele só existe no env).
4. Secrets (valores novos, não reusar os de prod):
   - `wrangler secret put MASTER_KEY --env staging`
   - `wrangler secret put BETTER_AUTH_SECRET --env staging`
   - `wrangler secret put DEEPSEEK_API_KEY --env staging`
   - VAPID: `npx web-push generate-vapid-keys` gera um par novo; publicKey entra
     no `VAPID_PUBLIC_KEY` das vars do staging e privateKey em
     `wrangler secret put VAPID_PRIVATE_KEY --env staging` (o par precisa casar).
5. Deploy: `bun run build && wrangler deploy --env staging`
6. Smoke test: cadastrar usuário novo no subdomínio de staging, onboarding +
   Pluggy, e o cron via botão "Trigger" no painel.

Script já no `package.json`: `deploy:staging` (build + migrações + deploy, tudo
apontando pro env staging). Staging é deploy **manual** — não tem job/pipeline
automático.

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
