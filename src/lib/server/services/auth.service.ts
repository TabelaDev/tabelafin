import type { Cookies } from '@sveltejs/kit';

import { type SessionData, SessionService } from './session.service';
import { UserService } from './user.service';

export class AuthService {
	constructor(
		private sessionService: SessionService,
		private userService: UserService
	) {}

	async validateSession(token: string) {
		const session = await this.sessionService.validate(token);
		if (!session) return null;

		const user = await this.userService.findById(session.userId);
		if (!user) {
			await this.sessionService.delete(token);
			return null;
		}

		return user;
	}

	async login(cookies: Cookies, userId: string, name: string, email: string) {
		const token = await this.sessionService.create(userId, name, email);
		this.sessionService.setCookie(cookies, token);
		return token;
	}

	async logout(cookies: Cookies, token: string) {
		await this.sessionService.delete(token);
		this.sessionService.clearCookie(cookies);
	}

	async updateSessionName(cookies: Cookies, token: string, name: string) {
		await this.sessionService.updateName(token, name);
	}

	getSessionToken(cookies: Cookies) {
		return this.sessionService.getToken(cookies);
	}
}
