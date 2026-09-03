# Decisão: extensão do navegador pra conectar o Open Finance

> ADR — contexto completo, prós e contras, e a escolha final. Serve também como
> material pra um artigo de blog sobre o assunto.

## O problema em uma frase

O TabelaFin é BYOK (cada usuário traz a própria credencial) e feito pra quem
**não programa**. A Pluggy oferece caminhos diferentes pra puxar dados
bancários, e cada um cobra um preço diferente em fricção, privacidade e
durabilidade. Escolher o caminho é a decisão mais cara do produto — errar
significa onboarding que ninguém termina.

## As opções na mesa

### 1. Token do Meu Pluggy, copiado à mão (o fluxo original)

O usuário loga no **Meu Pluggy** (o produto consumidor da própria Pluggy),
copia o JWT de sessão dos DevTools e cola no app.

- **Prós**: zero configuração — a pessoa só faz login no que ela já usa. As
  conexões de banco já existem lá; dados reais sem aprovação nenhuma.
- **Contras**: o token expira em ~24h e o copy-paste manual é o tipo de atrito
  que derruba onboarding de não-coder. E `my-api.pluggy.ai` é uma API interna,
  não documentada — pode quebrar sem aviso.

### 2. Client ID/Secret por usuário (BYOK "de verdade")

O usuário cria uma conta de desenvolvedor no dashboard da Pluggy, cria uma
**aplicação**, cola o Client ID/Secret. Credenciais de longo prazo, API oficial
(`api.pluggy.ai`).

- **Prós**: durabilidade (não expira), API documentada e estável.
- **Contras**: é um fluxo de _desenvolvedor_ — criar conta, criar app, entender
  o que é Client ID/Secret. E o golpe fatal: contas novas ficam em **sandbox**
  (só o conector de teste "Pluggy Bank"), então pra dados reais cada usuário
  teria que **pedir aprovação de acesso a dados reais individualmente**. Uma
  aprovação por usuário é inviável pra um público que não coda.

### 3. Pluggy Connect com um app único da TAbelhaDev

A TAbelhaDev segura uma única aplicação + credencial, e o usuário final só clica
em "conectar banco" num widget.

- **Prós**: de longe a menor fricção pro usuário final — é o padrão de todo
  fintech.
- **Contras**: abre mão do BYOK (a credencial-mestra vira nossa), vira relação
  comercial com a Pluggy, e centraliza os dados de todos sob a nossa chave.
  Contradiz o "seus dados, sua chave" do produto.

### 4. Token do Meu Pluggy, capturado por uma extensão (a escolhida)

O usuário loga no Meu Pluggy como no fluxo 1, mas uma extensão do Chrome
captura o token **automaticamente** — ele nunca copia nada.

- **Prós**: mantém o melhor do fluxo 1 (só fazer login, dados reais sem
  aprovação, BYOK) e elimina o pior dele (o copy-paste). Sem store, sem
  pagamento, sem review.
- **Contras**: ainda herda a expiração de ~24h e a fragilidade da API interna; e
  adiciona a instalação de uma extensão descompactada (modo desenvolvedor), que
  tem seu próprio atrito.

## A decisão

**Extensão Chrome descompactada (Manifest V3) que intercepta o `Authorization:
Bearer` das chamadas do Meu Pluggy e envia o token pro app** — mantendo o login
simples, o BYOK e os dados reais, sem a aprovação por-usuário que inviabiliza o
Client ID/Secret.

A extensão resolve a expiração de graça: toda vez que a pessoa abre o Meu
Pluggy, ela vê um token fresco e o reenvia pro backend. O token continua vivo
enquanto o usuário usar o Meu Pluggy — que é o comportamento natural de quem
acompanha as próprias contas.

## Como a captura funciona (sem depender de onde o Auth0 guarda o token)

O token não fica acessível em `localStorage` de forma confiável (o Auth0 SPA
mantém em memória). A extensão não tenta ler armazenamento: ela roda um content
script no `MAIN world`, embrulha `fetch`/`XMLHttpRequest` e captura o header
`Authorization: Bearer` quando o Meu Pluggy chama a própria API. Funciona
independente de onde o token vive.

## Segurança e auth

O token do Meu Pluggy é a sessão do próprio usuário — sensível. Por isso:

- **Device token**: um código de longo prazo pareado uma única vez na página de
  perfil / onboarding, que a extensão guarda em `chrome.storage.local` e reusa.
  O cookie de sessão do app é `HttpOnly` + `SameSite=Lax`, então não viajaria
  num fetch cross-origin vindo do service worker da extensão — o device token
  contorna isso.
- **Criptografia em repouso**: o token chega por HTTPS e é criptografado no
  banco (mesma derivação usada pras demais credenciais), nunca em texto puro.
  O arquivo da planilha/upload nunca é persistido; aqui também o token é
  descartado após a validação + gravação criptografada.

## Onboarding: guiado + granular

O app mantém um **onboarding geral com steps** (IA → Open Finance), mas cada
etapa também abre **isolada no perfil**: dá pra reconfigurar só a IA, só o Open
Finance, ou só re-parear a extensão — sem refazer o fluxo inteiro. Isso evita o
padrão de "precisei trocar uma chave e tive que passar pelo onboarding de novo".

## Riscos assumidos (e por que aceitamos)

| Risco                                                     | Mitigação / trade-off aceito                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Token expira em ~24h                                      | A extensão reenvia ao abrir o Meu Pluggy; o cron diário é best-effort                                  |
| `my-api.pluggy.ai` é API interna, pode quebrar            | É o mesmo risco do fluxo que já funcionava; a alternativa "oficial" tem custo de produto proibitivo    |
| Instalar extensão descompactada                           | Documentamos o passo a passo; é um custo one-time menor que criar app + pedir aprovação                |
| Interceptar header é frágil se o Meu Pluggy mudar o front | Content script isolado e fácil de re-sincronizar; o fallback de colar token manual continua disponível |

## O que ficou de fora (e por quê)

- **Publicar na Chrome Web Store**: US$ 5 + review + manutenção. Não vale pra um
  app open source de nicho agora.
- **Capturar o refresh token** pra renovar em background: mais elegante, mas
  compete com a sessão do Auth0 e é frágil — fica pra uma segunda versão.
- **Pluggy Connect / Client ID/Secret**: ver itens 2 e 3 acima.

## Arquitetura (visão geral)

```
[meu.pluggy.ai]  ──login──▶  [Meu Pluggy SPA chama my-api.pluggy.ai]
        │                            │  Authorization: Bearer <token>
        ▼                            ▼
[content.js]  intercepta o header →  chrome.runtime.sendMessage({type:'PLUGGY_TOKEN'})
                                        │
                                        ▼
[background.js]  POST /api/pluggy/token   (Authorization: Bearer <deviceToken>)
                                        │
                                        ▼
[app: api/pluggy/token]  valida token (fetchItems) → criptografa → upsert creds/items → sync
```

## Arquivos

- Extensão: `extension/` (manifest, content, background, popup, README).
- Endpoints: `src/routes/api/pluggy/{device,token,status}/+server.ts`.
- Pareamento: `src/lib/server/pluggy/device-token.ts`.
- Onboarding/perfil: `OnboardingModal.svelte`, `(app)/profile/+page.svelte`.
