# Extensão TabelaFin — Bridge do Meu Pluggy

Extensão do Chrome (Manifest V3, **sem publicar na Web Store**) que captura o
token de sessão do Meu Pluggy automaticamente e sincroniza com o TabelaFin. O
usuário só precisa **fazer login no Meu Pluggy** — nada de copiar e colar.

Contexto completo da decisão (e o porquê da extensão em vez de Client
ID/Secret ou do Pluggy Connect): `docs/pluggy-integration.md`.

## Instalação (modo desenvolvedor)

1. Abra `chrome://extensions` no Chrome (ou Edge/Brave).
2. Ative o **Modo desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione esta pasta (`extension/`).
4. O ícone da extensão aparece na barra.

## Pareamento (uma vez)

1. No TabelaFin (Perfil → Extensão do navegador → "Vincular / revisar"), clique
   em **Gerar código de pareamento**.
2. Copie o código e abra o popup desta extensão.
3. Cole o código no campo **Código de pareamento** e clique em **Salvar**.
   - Deixe o campo **Origem do app** com o valor padrão
     (`https://tabelafin.ianptkcs-023.workers.dev`), ou aponte pro staging/dev
     se estiver testando localmente.

## Uso

Abra o Meu Pluggy (`meu.pluggy.ai`) e faça login. O content script intercepta o
header `Authorization: Bearer` das chamadas à `my-api.pluggy.ai` e envia o
token pro app, que valida, criptografa e sincroniza.

O token do Meu Pluggy expira em ~24h. **Não se preocupe**: toda vez que você
abrir o Meu Pluggy, a extensão reenvia um token fresco — o app fica sempre
atualizado enquanto você usar o Meu Pluggy. O popup mostra o resultado do
último envio.

## Como funciona

- `content.js` — roda no `MAIN world` em `document_start`, embrulha `fetch`/XHR
  e captura o `Bearer` (o token não fica em `localStorage`, então é interceptado
  na rede).
- `background.js` — service worker que manda o token pro app em
  `/api/pluggy/token`, autenticado pelo device token pareado.
- `popup.html/js` — configura origem + código de pareamento e mostra o status.

## Solução de problemas

| Sintoma                                 | Causa / ação                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Popup diz "Nenhum código de pareamento" | Gere e cole o código de pareamento no app (Perfil → Extensão).                    |
| "Código de pareamento inválido"         | O código expirou (válido por 1 ano) ou foi digitado errado — gere outro.          |
| Nada sincroniza após abrir o Meu Pluggy | Confira se está logado no Meu Pluggy e se a origem no popup aponta pro app certo. |
| Troquei de navegador                    | Parear de novo: o device token fica no `chrome.storage` de cada navegador.        |
