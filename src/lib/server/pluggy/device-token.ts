// Device token de pareamento da extensão (ver docs/pluggy-integration.md).
//
// A extensão autentica nos endpoints da API com este token de longo prazo, em
// vez do cookie de sessão: o cookie é HttpOnly + SameSite=Lax, então não viaja
// num fetch cross-origin vindo do service worker da extensão. O pareamento é
// feito uma única vez na página de perfil / onboarding, e o token fica
// guardado no KV `SESSIONS` (chave `pluggy_device:<token>`) mapeando pro
// userId — o endpoint `/api/pluggy/token` resolve a sessão a partir dele.

/** Gera um device token aleatório (256 bits) em base64url. */
export function generateDeviceToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

export const DEVICE_TOKEN_KV_PREFIX = 'pluggy_device:';
export const DEVICE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365;
