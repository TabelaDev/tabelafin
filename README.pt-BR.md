<div align="center">

# TabelaFin

**Finanças pessoais com sync automático via Open Finance e categorização com IA — BYOK, sem assinatura.**

[English](README.md) · **Português**

[![SvelteKit](https://img.shields.io/badge/SvelteKit-Svelte-ff3e00?style=flat-square&logo=svelte&logoColor=white)](https://kit.svelte.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Built with tabelawebui](https://img.shields.io/badge/theme-tabelawebui-d6b4f7?style=flat-square)](https://github.com/TabelaDev/tabelawebui)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/ianptkcs)

</div>

---

## O que é

App de finanças pessoais que puxa sozinho os dados do Nubank (conta + cartão)
e da XP (conta digital + investimentos) via Open Finance, categoriza gastos
com IA e gera um relatório mensal de onde dá pra melhorar — sem lançamento
manual.

O domínio aqui é o Open Finance brasileiro, então a interface é em português. O
código é em inglês; veja o [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md#idioma)
pra convenção.

## Como funciona

1. Você conecta suas contas ao **Meu Pluggy** (o produto pessoal e gratuito da
   Pluggy) e cola o token de acesso da sua sessão no onboarding do TabelaFin.
2. Um cron diário sincroniza accounts, transactions e investments via a API do
   Meu Pluggy.
3. As transações novas são categorizadas em lote pela sua própria IA (BYOK),
   ou por regras simples se a IA não estiver configurada.
4. No dia 1 de cada mês, um relatório do mês anterior é gerado e você recebe
   um push avisando que está pronto.
5. Upload de PDF de fatura/extrato existe como fallback manual — o arquivo
   é enviado direto pro modelo de IA escolhido (document understanding), sem
   lib de parsing.

Existe também uma importação em massa dos extratos que chegaram por email: ela
lê um export do Google Takeout no navegador, extrai os PDFs do `.mbox` e passa
cada um pela mesma extração, um por vez.

Também funciona como PWA: você pode "instalar" no celular ou no desktop e usar
como um app nativo, com atualização automática.

IA e conexão Open Finance são **opcionais** — o app funciona sem nenhuma das
duas: você lança transações manualmente e a categorização por regras cobre o
básico.

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
bun run check     # typecheck
bun run lint      # prettier + eslint
bun run test      # testes unitários
bun run test:e2e  # testes E2E (Playwright)
bun run build     # build de produção
bun run deploy    # build + migrations remotas + deploy
```

`MASTER_KEY` pra criptografia das credenciais, `BETTER_AUTH_SECRET` pra
autenticação (email/senha via Better Auth) e `VAPID_PRIVATE_KEY` pro push
do relatório mensal.

## Desenvolvimento

Stack e comandos: veja a seção _Rodando localmente_ acima. Testes:

```sh
bun run test      # testes unitários
bun run test:e2e  # testes E2E (Playwright)
```

## Changelog

Veja [CHANGELOG.md](CHANGELOG.md) para o histórico de versões.

## Apoie o projeto

- **Global**: [ko-fi.com/ianptkcs](https://ko-fi.com/ianptkcs)
- **Brasil (Pix)**: escaneie o QR abaixo ou copie o código

  <img src="pix-qr.png" alt="Pix QR" width="200" />

  <details><summary>Código Pix (copiar)</summary>

  ```
  00020126580014BR.GOV.BCB.PIX01365ad933b0-dcdc-4525-a736-0759902aeec65204000053039865802BR5925Ian Patrick da Costa Soar6009SAO PAULO62140510tQA85x6Dov63041FB6
  ```

  </details>

## Licença

[AGPL-3.0](LICENSE) — copyleft forte: você pode usar, modificar e até
hospedar o TabelaFin comercialmente, mas qualquer versão modificada, inclusive
rodando como serviço via rede (SaaS), precisa continuar open source sob a
mesma licença.
