# auth — Reusable authentication module

Authentication module built on Better Auth, ready to copy into any SvelteKit + Drizzle + Cloudflare Workers project.

## Structure

```
src/lib/auth/
├── index.ts              # Entry point (re-exports)
├── create.ts             # Creates the Better Auth instance
├── errors.ts             # Maps errors to friendly messages
├── cookies.ts            # Forwards session cookies
├── schema.ts             # Drizzle schema for the Better Auth tables
├── hooks.ts              # SvelteKit hook to resolve the session
└── components/
    ├── LoginForm.svelte   # Reusable login form
    └── RegisterForm.svelte # Reusable sign-up form
```

## Setup

### 1. Install dependencies

```bash
bun add better-auth @better-auth/drizzle-adapter
```

### 2. Copy the `src/lib/auth/` folder

Copy the whole folder into the new project.

### 3. Add tables to the Drizzle schema

In your `src/lib/server/db/schema.ts`, import and use the tables from `auth/schema.ts`:

```ts
import { authUser, authSession, authAccount } from '$lib/auth/schema';

// Add app-specific fields to authUser if needed
export const users = sqliteTable('user', {
	...authUser,
	timezone: text('timezone').notNull().default('UTC')
});

// Re-export for Better Auth
export const sessions = authSession;
export const accounts = authAccount;
```

### 4. Configure env vars

```bash
BETTER_AUTH_SECRET="your-32char-secret"
BETTER_AUTH_URL="http://localhost:5173"
```

### 5. Create the auth instance

```ts
import { createAuth } from '$lib/auth/create';
import { getDb } from '$lib/server/db';

const auth = createAuth({
	db: getDb(env.DB),
	provider: 'sqlite',
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	cookiePrefix: 'myapp'
});
```

### 6. Configure the hook

```ts
// hooks.server.ts
import { handleAuth } from '$lib/auth/hooks';
import { getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';

export const handle = handleAuth(getAuth, getDb);
```

### 7. Create the routes

#### Login (`src/routes/login/+page.server.ts`)

```ts
import { fail, redirect } from '@sveltejs/kit';
import { getAuth } from '$lib/auth/create';
import { forwardCookies } from '$lib/auth/cookies';
import { friendlyAuthError } from '$lib/auth/errors';

export const actions = {
	default: async ({ request, cookies, platform }) => {
		const form = await request.formData();
		const email = form.get('email');
		const password = form.get('password');

		if (typeof email !== 'string' || typeof password !== 'string') {
			return fail(400, { error: 'Informe e-mail e senha.' });
		}

		const auth = getAuth(platform!.env);

		try {
			const response = await auth.api.signInEmail({
				body: { email, password },
				asResponse: true
			});

			if (!response.ok) {
				const body = await response.json();
				return fail(400, { error: friendlyAuthError(new Error(body?.message)) });
			}

			forwardCookies(response, cookies);
		} catch (e) {
			return fail(400, { error: friendlyAuthError(e) });
		}

		redirect(303, '/dashboard');
	}
};
```

#### Sign-up — same pattern with `signUpEmail`.

### 8. Components

```svelte
<!-- src/routes/login/+page.svelte -->
<script>
	import LoginForm from '$lib/auth/components/LoginForm.svelte';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<LoginForm error={form?.error} />
```

```svelte
<!-- src/routes/signup/+page.svelte -->
<script>
	import RegisterForm from '$lib/auth/components/RegisterForm.svelte';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<RegisterForm error={form?.error} />
```

## Database migration

Run `npx auth@latest generate` to generate the migrations, or create them by hand following the schema in `auth/schema.ts`.

## Reference

- [Better Auth Docs](https://www.better-auth.com/docs)
- [Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [SvelteKit Integration](https://www.better-auth.com/docs/integrations/sveltekit)
