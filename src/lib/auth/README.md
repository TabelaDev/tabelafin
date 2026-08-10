# auth — Módulo reutilizável de autenticação

Módulo de autenticação via Better Auth, pronto pra copiar e usar em qualquer projeto SvelteKit + Drizzle + Cloudflare Workers.

## Estrutura

```
src/lib/auth/
├── index.ts              # Entry point (re-exports)
├── create.ts             # Cria instância do Better Auth
├── errors.ts             # Mapeamento de erros pra mensagens amigáveis
├── cookies.ts            # Encaminhamento de cookies de sessão
├── schema.ts             # Schema Drizzle das tabelas Better Auth
├── hooks.ts              # Hook do SvelteKit pra resolver sessão
└── components/
    ├── LoginForm.svelte   # Formulário de login reutilizável
    └── RegisterForm.svelte # Formulário de cadastro reutilizável
```

## Setup

### 1. Instalar dependências

```bash
bun add better-auth @better-auth/drizzle-adapter
```

### 2. Copiar a pasta `src/lib/auth/`

Copie toda a pasta pro novo projeto.

### 3. Adicionar tabelas ao schema Drizzle

No seu `src/lib/server/db/schema.ts`, importe e use as tabelas de `auth/schema.ts`:

```ts
import { authUser, authSession, authAccount } from '$lib/auth/schema';

// Adicione campos próprios do app ao authUser se necessário
export const users = sqliteTable('user', {
	...authUser,
	timezone: text('timezone').notNull().default('UTC')
});

// Re-exporta pra Better Auth
export const sessions = authSession;
export const accounts = authAccount;
```

### 4. Configurar env vars

```bash
BETTER_AUTH_SECRET="seu-segredo-32chars"
BETTER_AUTH_URL="http://localhost:5173"
```

### 5. Criar instância do auth

```ts
import { createAuth } from '$lib/auth/create';
import { getDb } from '$lib/server/db';

const auth = createAuth({
	db: getDb(env.DB),
	provider: 'sqlite',
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	cookiePrefix: 'meuapp'
});
```

### 6. Configurar hook

```ts
// hooks.server.ts
import { handleAuth } from '$lib/auth/hooks';
import { getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';

export const handle = handleAuth(getAuth, getDb);
```

### 7. Criar rotas

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

#### Cadastro — mesmo padrão com `signUpEmail`.

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
<!-- src/routes/cadastro/+page.svelte -->
<script>
	import RegisterForm from '$lib/auth/components/RegisterForm.svelte';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<RegisterForm error={form?.error} />
```

## Migration do banco

Rode `npx auth@latest generate` pra gerar as migrations, ou crie manualmente seguindo o schema em `auth/schema.ts`.

## Referência

- [Better Auth Docs](https://www.better-auth.com/docs)
- [Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [SvelteKit Integration](https://www.better-auth.com/docs/integrations/sveltekit)
