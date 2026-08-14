// Content script (world: MAIN, document_start) — captures the Meu Pluggy token.
//
// The token is the Auth0 session of Meu Pluggy: it lives in the SPA's memory,
// not in localStorage, so there is no fixed place to "read" it from. Instead,
// this script wraps fetch/XHR and intercepts the Authorization: Bearer header
// that Meu Pluggy sends to my-api.pluggy.ai. It runs in the MAIN world at
// document_start so it is in place before the SPA's first request.
(() => {
	const API_URL = 'https://my-api.pluggy.ai';
	const captured = new Set();

	function report(token) {
		if (!token || captured.has(token)) return;
		captured.add(token);
		chrome.runtime.sendMessage({ type: 'PLUGGY_TOKEN', token });
	}

	function bearerFrom(headers) {
		if (!headers) return null;
		const extract = (v) =>
			typeof v === 'string' && /^Bearer\s+/i.test(v) ? v.replace(/^Bearer\s+/i, '').trim() : null;
		if (headers instanceof Headers) return extract(headers.get('authorization'));
		if (Array.isArray(headers)) {
			const pair = headers.find(([k]) => String(k).toLowerCase() === 'authorization');
			return pair ? extract(pair[1]) : null;
		}
		if (typeof headers === 'object') {
			for (const key of Object.keys(headers)) {
				if (key.toLowerCase() === 'authorization') return extract(headers[key]);
			}
		}
		return null;
	}

	const urlOf = (input) =>
		typeof input === 'string' ? input : input && typeof input.url === 'string' ? input.url : '';

	const originalFetch = window.fetch.bind(window);
	window.fetch = async (...args) => {
		const [input, init] = args;
		if (urlOf(input).startsWith(API_URL)) {
			const token = bearerFrom(init && init.headers);
			if (token) report(token);
		}
		return originalFetch(...args);
	};

	const originalOpen = XMLHttpRequest.prototype.open;
	const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
	XMLHttpRequest.prototype.open = function (method, url, ...rest) {
		this.__tabelafinUrl = String(url);
		return originalOpen.call(this, method, url, ...rest);
	};
	XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
		if (
			String(name).toLowerCase() === 'authorization' &&
			this.__tabelafinUrl &&
			this.__tabelafinUrl.startsWith(API_URL)
		) {
			report(bearerFrom({ authorization: String(value) }));
		}
		return originalSetHeader.call(this, name, value);
	};
})();
