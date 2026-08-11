// Maps Better Auth errors onto messages a user can act on.
// Reusable — copy into any project.

export function friendlyAuthError(e: unknown): string {
	if (!(e instanceof Error)) return 'Ocorreu um erro inesperado.';

	const msg = e.message.toLowerCase();

	// Signup
	if (msg.includes('user already exists') || msg.includes('already registered')) {
		return 'Já existe uma conta com este e-mail.';
	}

	// Login
	if (msg.includes('invalid credentials') || msg.includes('wrong password')) {
		return 'E-mail ou senha incorretos.';
	}
	if (msg.includes('user not found')) {
		return 'Nenhuma conta encontrada com este e-mail.';
	}

	// Validation
	if (msg.includes('invalid email')) {
		return 'E-mail inválido.';
	}
	if (msg.includes('password too short') || msg.includes('password must be')) {
		return 'A senha deve ter pelo menos 8 caracteres.';
	}

	// Session
	if (msg.includes('email not verified')) {
		return 'E-mail ainda não verificado.';
	}
	if (msg.includes('session')) {
		return 'Sessão expirada. Faça login novamente.';
	}

	// Infra
	if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
		return 'Erro de conexão. Tente novamente.';
	}
	if (msg.includes('database') || msg.includes('d1')) {
		return 'Erro interno. Tente novamente em alguns instantes.';
	}

	// Fallback — never leak an internal error
	return 'Ocorreu um erro. Tente novamente.';
}
