// Extension service worker — receives the token captured by the content script
// and sends it to the app via /api/pluggy/token (authenticated by the paired
// device token).
//
// The Meu Pluggy token expires in ~24h; this flow runs every time the user
// opens Meu Pluggy, so the app always has a fresh token with no action needed.
const DEFAULT_ORIGIN = 'https://tabelafin.ianptkcs-023.workers.dev';

async function pushToken(token) {
	const { origin, deviceToken } = await chrome.storage.local.get(['origin', 'deviceToken']);
	const target = (origin || DEFAULT_ORIGIN).replace(/\/+$/, '');
	if (!deviceToken) {
		return { ok: false, error: 'Nenhum código de pareamento. Configure no popup.' };
	}

	let res;
	try {
		res = await fetch(`${target}/api/pluggy/token`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${deviceToken}` },
			body: JSON.stringify({ token })
		});
	} catch {
		return { ok: false, error: `Sem conexão com ${target}` };
	}

	const body = await res.json().catch(() => null);
	if (!res.ok) return { ok: false, error: (body && body.error) || `HTTP ${res.status}` };
	return { ok: true, count: body && body.count };
}

// Only the Meu Pluggy tab may hand us a token. The content script runs in the
// MAIN world — the page's own JS context — so any script loaded on that page,
// or an XSS in it, can call chrome.runtime.sendMessage too. Dropping `sender`
// on the floor meant an attacker-chosen token would be stored as the victim's
// Meu Pluggy credential, pointing their sync at accounts they do not own.
//
// Checking the origin does not make the MAIN world safe against the page
// itself; it bounds the damage to that one origin, which is the most this
// architecture offers. A capture path outside the page's context is the real
// fix — see docs/pluggy-integration.md.
const TRUSTED_ORIGIN = 'https://meu.pluggy.ai';

function isTrustedSender(sender) {
	// Extension pages (the popup) carry no tab and are inherently trusted.
	if (sender && sender.id === chrome.runtime.id && !sender.tab) return true;
	if (!sender || !sender.url) return false;
	try {
		return new URL(sender.url).origin === TRUSTED_ORIGIN;
	} catch {
		return false;
	}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message && message.type === 'PLUGGY_TOKEN') {
		if (!isTrustedSender(sender)) {
			console.warn('[tabelafin] mensagem de origem não confiável ignorada');
			sendResponse({ ok: false, error: 'Origem não confiável.' });
			return true;
		}
		pushToken(message.token)
			.then((result) => {
				chrome.storage.local.set({ lastResult: { at: Date.now(), ...result } });
				sendResponse(result);
			})
			.catch((err) => sendResponse({ ok: false, error: String(err) }));
		return true; // mantém o canal aberto pra resposta assíncrona
	}
});
