const $ = (id) => document.getElementById(id);

chrome.storage.local
	.get(['origin', 'deviceToken', 'lastResult'])
	.then(({ origin, deviceToken, lastResult }) => {
		$('origin').value = origin || '';
		$('device').value = deviceToken || '';
		if (lastResult) renderResult(lastResult);
	});

$('save').addEventListener('click', async () => {
	const origin = $('origin').value.trim();
	const deviceToken = $('device').value.trim();
	await chrome.storage.local.set({ origin, deviceToken });
	$('status').textContent = 'Salvo. Abra o Meu Pluggy pra capturar o token automaticamente.';
});

function renderResult(result) {
	const el = $('result');
	if (result.ok) {
		const at = result.at ? new Date(result.at).toLocaleTimeString('pt-BR') : '';
		el.innerHTML = `<span class="ok">Sincronizado${at ? ' às ' + at : ''}${
			typeof result.count === 'number' ? ` — ${result.count} conexão(ões)` : ''
		}.</span>`;
	} else {
		el.innerHTML = `<span class="err">${escapeHtml(result.error || 'Falha')}</span>`;
	}
}

function escapeHtml(value) {
	return String(value).replace(
		/[&<>"]/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
	);
}
