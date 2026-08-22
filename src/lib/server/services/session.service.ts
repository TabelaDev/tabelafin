import type { Cookies } from '@sveltejs/kit';

const SESSION_COOKIE = 'tabelafin_session_token';
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;
const KV_PREFIX = 'tabelafin:session:';

export interface SessionData {
	userId: string;
	name: string;
	email: string;
	expiresAt: number;
}

export class SessionService {
	constructor(private kv: KVNamespace) {}

	async validate(token: string): Promise<SessionData | null> {
		const raw = await this.kv.get<SessionData>(`${KV_PREFIX}${token}`, 'json');
		if (!raw) return null;

		if (Math.floor(Date.now() / 1000) > raw.expiresAt) {
			await this.kv.delete(`${KV_PREFIX}${token}`);
			return null;
		}

		return raw;
	}

	async create(userId: string, name: string, email: string): Promise<string> {
		const token = crypto.randomUUID();
		const data: SessionData = {
			userId,
			name,
			email,
			expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
		};

		await this.kv.put(`${KV_PREFIX}${token}`, JSON.stringify(data), {
			expirationTtl: SESSION_TTL_SECONDS
		});

		return token;
	}

	async delete(token: string): Promise<void> {
		await this.kv.delete(`${KV_PREFIX}${token}`);
	}

	async updateName(token: string, name: string): Promise<void> {
		const raw = await this.kv.get<SessionData>(`${KV_PREFIX}${token}`, 'json');
		if (!raw) return;
		raw.name = name;
		await this.kv.put(`${KV_PREFIX}${token}`, JSON.stringify(raw), {
			expirationTtl: SESSION_TTL_SECONDS
		});
	}

	getToken(cookies: Cookies): string | null {
		return cookies.get(SESSION_COOKIE) ?? null;
	}

	setCookie(cookies: Cookies, token: string): void {
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: SESSION_TTL_SECONDS
		});
	}

	clearCookie(cookies: Cookies): void {
		cookies.delete(SESSION_COOKIE, { path: '/' });
	}
}
