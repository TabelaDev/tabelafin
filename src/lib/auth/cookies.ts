// Utilitário pra encaminhar cookies de sessão do Better Auth pro SvelteKit.
// Reutilizável — copie pra qualquer projeto.
//
// Uso nas actions de login/cadastro:
//   import { forwardCookies } from '$lib/auth/cookies';
//   const response = await auth.api.signInEmail({ body, asResponse: true });
//   forwardCookies(response, cookies);

import type { Cookies } from '@sveltejs/kit';

export function forwardCookies(response: Response, cookies: Cookies): void {
	const setCookie = response.headers.get('set-cookie');
	if (!setCookie) return;

	// Split em cookies individuais — cada um termina antes do próximo nome
	const parts = setCookie.split(/,(?=[^;]+=[^;])/);
	for (const part of parts) {
		const cookie = part.trim();
		if (!cookie) continue;

		const [nameValue] = cookie.split(';');
		const eqIdx = nameValue.indexOf('=');
		if (eqIdx === -1) continue;

		const cookieName = nameValue.substring(0, eqIdx).trim();
		const cookieValue = nameValue.substring(eqIdx + 1).trim();

		if (cookieName && cookieValue) {
			cookies.set(cookieName, cookieValue, {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax'
			});
		}
	}
}
