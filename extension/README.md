# TabelaFin Extension — Meu Pluggy Bridge

A Chrome extension (Manifest V3, **not published to the Web Store**) that captures
the Meu Pluggy session token automatically and syncs it with TabelaFin. The user
only needs to **sign in to Meu Pluggy** — no copy-paste.

Full context on the decision (and why an extension instead of Client ID/Secret or
Pluggy Connect): `docs/pluggy-integration.md`.

## Installation (developer mode)

1. Open `chrome://extensions` in Chrome (or Edge/Brave).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (`extension/`).
4. The extension icon shows up in the toolbar.

## Pairing (one time)

1. In TabelaFin (Profile → Browser extension → "Pair / review"), click
   **Generate pairing code**.
2. Copy the code and open this extension's popup.
3. Paste the code into the **Pairing code** field and click **Save**.
   - Keep the **App origin** field at its default
     (`https://tabelhafin.tabelhadev.workers.dev`), or point it to staging/dev
     when testing locally.

## Usage

Open Meu Pluggy (`meu.pluggy.ai`) and sign in. The content script intercepts the
`Authorization: Bearer` header on calls to `my-api.pluggy.ai` and sends the
token to the app, which validates, encrypts and syncs it.

The Meu Pluggy token expires in ~24h. **Don't worry**: every time you open Meu
Pluggy, the extension resends a fresh token — the app stays up to date as long
as you use Meu Pluggy. The popup shows the result of the last push.

## How it works

- `content.js` — runs in the `MAIN world` at `document_start`, wraps `fetch`/XHR
  and captures the `Bearer` token (the token is not in `localStorage`, so it is
  intercepted on the wire).
- `background.js` — service worker that pushes the token to the app at
  `/api/pluggy/token`, authenticated with the paired device token.
- `popup.html/js` — configures origin + pairing code and shows the status.

## Troubleshooting

| Symptom                                | Cause / action                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Popup says "No pairing code"           | Generate and paste the pairing code in the app (Profile → Browser extension).                        |
| "Invalid pairing code"                 | The code expired (valid for 1 year) or was mistyped — generate another one.                          |
| Nothing syncs after opening Meu Pluggy | Check that you are signed in to Meu Pluggy and that the origin in the popup points to the right app. |
| I switched browsers                    | Pair again: the device token lives in each browser's `chrome.storage`.                               |
