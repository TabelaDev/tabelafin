import type { RequestHandler } from './$types';
import { getAuth } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, platform }) => {
	const auth = getAuth(platform!.env);
	return auth.handler(request);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const auth = getAuth(platform!.env);
	return auth.handler(request);
};
