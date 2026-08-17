// Maps Better Auth errors onto messages a user can act on.
// Internal errors (DB, network, etc.) become generic messages.
export function friendlyAuthError(e: unknown): string {
	if (!(e instanceof Error)) return 'Ocorreu um erro inesperado.';

	const msg = e.message.toLowerCase();

	// Better Auth errors
	if (msg.includes('invalid credentials') || msg.includes('wrong password')) {
		return 'E-mail ou senha incorretos.';
	}
	if (msg.includes('user not found')) {
		return 'Nenhuma conta encontrada com este e-mail.';
	}
	if (msg.includes('user already exists') || msg.includes('already registered')) {
		return 'Já existe uma conta com este e-mail.';
	}
	if (msg.includes('invalid email')) {
		return 'E-mail inválido.';
	}
	if (msg.includes('password too short') || msg.includes('password must be')) {
		return 'A senha deve ter pelo menos 8 caracteres.';
	}
	// Says what to do, not just what is wrong: without the second sentence the
	// user is told their e-mail is unverified and given no way forward.
	if (msg.includes('email not verified') || msg.includes('not verified')) {
		return 'E-mail ainda não verificado. Confira sua caixa de entrada (e o spam) pelo link de confirmação.';
	}
	if (msg.includes('session')) {
		return 'Sessão expirada. Faça login novamente.';
	}

	// Network/infra errors
	if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
		return 'Erro de conexão. Tente novamente.';
	}
	if (msg.includes('database') || msg.includes('d1')) {
		return 'Erro interno. Tente novamente em alguns instantes.';
	}

	// Fallback — never leak internal error messages
	return 'Ocorreu um erro. Tente novamente.';
}
