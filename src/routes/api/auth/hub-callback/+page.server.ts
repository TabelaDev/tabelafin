import { env } from '$env/dynamic/private';

import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, platform, cookies, locals }) => {
	const hubToken = url.searchParams.get('hub_token');
	if (!hubToken || !platform?.env) {
		return redirect(303, '/login');
	}

	const hubUrl =
		platform.env.PUBLIC_TABELHAUTH_URL ||
		env.PUBLIC_TABELHAUTH_URL ||
		'https://tabelhaauth.tabelhadev.workers.dev';

	try {
		const exchangeRes = await fetch(
			`${hubUrl}/api/auth/exchange?token=${encodeURIComponent(hubToken)}&appId=tabelafin`
		);

		if (!exchangeRes.ok) {
			return redirect(303, '/login');
		}

		const hubUser = (await exchangeRes.json()) as {
			userId: string;
			name: string;
			email: string;
		};

		const existingUser = await locals.userService.findById(hubUser.userId);
		if (!existingUser) {
			await locals.userService.create({
				id: hubUser.userId,
				name: hubUser.name,
				email: hubUser.email
			});
		}

		await locals.authService.login(cookies, hubUser.userId, hubUser.name, hubUser.email);
	} catch {
		return redirect(303, '/login');
	}

	return redirect(303, '/dashboard');
};
