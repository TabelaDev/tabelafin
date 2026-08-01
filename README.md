# TabelaFin

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
5. Upload de PDF de fatura/extrato existe como fallback manual — o arquivo é
   enviado direto pro modelo de IA escolhido (document understanding), sem
   lib de parsing.

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

Ver `ESCOPO.md` pra decisões de produto com mais detalhe.

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
`MASTER_KEY` pra criptografia das credenciais dos usuários, e
`VAPID_PRIVATE_KEY` pro push do relatório mensal (o `.env.example` tem o
comando pra gerar um par de chaves novo).

## Licença

[AGPL-3.0](LICENSE) — copyleft forte: você pode usar, modificar e até
hospedar o TabelaFin comercialmente, mas qualquer versão modificada, inclusive
rodando como serviço via rede (SaaS), precisa continuar open source sob a
mesma licença.

Quer contribuir? Dá uma olhada em `CONTRIBUTING.md`.
