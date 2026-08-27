/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/info" />
import type { ToastType } from '$lib/enums/toast-type';
import type { AuthService } from '$lib/server/services/auth.service';
import type { SessionService } from '$lib/server/services/session.service';
import type { StatementService } from '$lib/server/services/statement.service';
import type { UserService } from '$lib/server/services/user.service';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		interface Locals {
			userId: string | null;
			session: {
				user: { id: string; name: string; email: string; image?: string | null };
				session: { id: string; token: string };
			} | null;
			authService: AuthService;
			sessionService: SessionService;
			userService: UserService;
			statementService: StatementService;
		}
		interface PageData {
			flash?: { type: ToastType; message: string };
		}
		// interface PageState {}
	}
}

export {};
