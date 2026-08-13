import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	DEVICE_TOKEN_KV_PREFIX,
	DEVICE_TOKEN_TTL_SECONDS,
	generateDeviceToken
} from '$lib/server/pluggy/device-token';

// Gera um código de pareamento de longo prazo para a extensão do navegador
// (ver docs/pluggy-integration.md). Chamado pela página de perfil / onboarding
// com a sessão do app; o código aparece UMA vez e é colado no popup da
// extensão. A partir daí a extensão usa este token no header Authorization ao
// enviar o token do Meu Pluggy pra /api/pluggy/token.
export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) return json({ error: 'Não autenticado.' }, { status: 401 });

	const deviceToken = generateDeviceToken();
	await platform!.env.SESSIONS.put(`${DEVICE_TOKEN_KV_PREFIX}${deviceToken}`, locals.userId, {
		expirationTtl: DEVICE_TOKEN_TTL_SECONDS
	});

	return json({ deviceToken });
};
