# TabelaFin

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/ianptkcs)

App de finanças pessoais que puxa sozinho os dados do Nubank (conta + cartão)
e da XP (conta digital + investimentos) via Open Finance, categoriza gastos
com IA e gera um relatório mensal de onde dá pra melhorar — sem lançamento
manual.

## Como funciona

1. Você conecta suas contas (Nubank, XP) ao **Meu Pluggy**, o produto pessoal
   e gratuito da Pluggy, e cola o Client ID/Secret gerados lá no onboarding do
   TabelaFin.
2. Um cron diário sincroniza accounts, transactions e investments via Pluggy.
3. As transações novas são categorizadas em lote pela sua própria IA (BYOK).
4. No dia 1 de cada mês, um relatório do mês anterior é gerado e você recebe
   um push avisando que está pronto.
5. Upload de PDF de fatura/extrato existe como fallback manual (ainda não
   implementado, ver "Status de implementação" no `ESCOPO.md`) — o arquivo
   será enviado direto pro modelo de IA escolhido (document understanding),
   sem lib de parsing.

Também funciona como PWA: você pode "instalar" no celular ou no desktop e usar
como um app nativo, com atualização automática.

## Traga suas próprias credenciais

Mesmo padrão BYOK do [TabelaCal](https://github.com/TabelaDev/tabelacal), em
dobro:

- **IA**: cole sua própria API key (Anthropic, OpenAI ou DeepSeek) e escolha o
  modelo. Você paga sua própria inferência.
- **Open Finance**: cada usuário traz sua própria conexão via
  [Meu Pluggy](https://www.pluggy.ai/meu-pluggy) (gratuito pra uso pessoal),
  em vez do TabelaFin manter uma conta Pluggy comercial paga compartilhada.

Ver `ESCOPO.md` pra decisões de produto com mais detalhe — incluindo a seção
"Status de implementação", que lista o que já está pronto, o que falta
(hoje: só o upload de PDF) e os pontos marcados `TODO(pluggy-verify)` pra
conferir antes de testar com uma conta Meu Pluggy real.

Login (só pra você, sem cadastro de outros usuários por enquanto) é feito
por token compartilhado, não por OAuth do Google — o TabelaFin não usa
nenhuma API do Google, diferente do TabelaCal. Ver `src/lib/server/auth.ts`.

## Rodando localmente

Stack: SvelteKit + Cloudflare Workers (D1 + KV), Bun como package manager.

```sh
bun install

# aplica as migrations no D1 local
bunx wrangler d1 migrations apply tabelafin-db --local

bun run dev
```

Outros comandos úteis:

```sh
bun run check   # typecheck (rodar antes de build — checar depois de um
                 # build local re-inclui o _worker.js gerado no typecheck)
bun run lint    # prettier + eslint
bun run test    # testes unitários
bun run build   # build de produção (worker + PWA assets)
```

Copie `.env.example` pra `.dev.vars` e preencha as variáveis antes de rodar:
`MASTER_KEY` pra criptografia das credenciais dos usuários, `LOGIN_TOKEN`
(o "app password" pra entrar, ver `src/lib/server/auth.ts`) e
`VAPID_PRIVATE_KEY` pro push do relatório mensal (o `.env.example` tem o
comando pra gerar cada par de chaves). `OWNER_EMAIL` (não é segredo) já está
em `wrangler.jsonc` com um placeholder — troque pelo seu e-mail real.

## Apoie o projeto

- **Global**: [ko-fi.com/ianptkcs](https://ko-fi.com/ianptkcs)
- **Brasil (Pix)**: escaneie o QR abaixo ou copie o código

  ![Pix QR](pix-qr.png)

  ```
  00020126580014BR.GOV.BCB.PIX01365ad933b0-dcdc-4525-a736-0759902aeec65204000053039865802BR5925Ian Patrick da Costa Soar6009SAO PAULO62140510tQA85x6Dov63041FB6
  ```

## Licença

[AGPL-3.0](LICENSE) — copyleft forte: você pode usar, modificar e até
hospedar o TabelaFin comercialmente, mas qualquer versão modificada, inclusive
rodando como serviço via rede (SaaS), precisa continuar open source sob a
mesma licença.

Quer contribuir? Dá uma olhada em `CONTRIBUTING.md`.
