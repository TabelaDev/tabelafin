// Service worker da extensão — recebe o token capturado pelo content script e
// envia pro app via /api/pluggy/token (autenticado pelo device token pareado).
//
// O token do Meu Pluggy expira em ~24h; este fluxo roda toda vez que o usuário
// abre o Meu Pluggy, então o app fica com um token fresco sem nenhuma ação.
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message && message.type === 'PLUGGY_TOKEN') {
		pushToken(message.token)
			.then((result) => {
				chrome.storage.local.set({ lastResult: { at: Date.now(), ...result } });
				sendResponse(result);
			})
			.catch((err) => sendResponse({ ok: false, error: String(err) }));
		return true; // mantém o canal aberto pra resposta assíncrona
	}
});
