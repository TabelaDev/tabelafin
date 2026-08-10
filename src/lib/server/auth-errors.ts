// Mapeia erros do Better Auth pra mensagens amigáveis ao usuário.
// Erros internos (DB, network, etc.) viram mensagens genéricas.
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
	if (msg.includes('email not verified')) {
		return 'E-mail ainda não verificado.';
	}
	if (msg.includes('session')) {
		return 'Sessão expirada. Faça login novamente.';
	}

	// Erros de rede/infra
	if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
		return 'Erro de conexão. Tente novamente.';
	}
	if (msg.includes('database') || msg.includes('d1')) {
		return 'Erro interno. Tente novamente em alguns instantes.';
	}

	// Fallback — nunca vazar mensagem de erro interna
	return 'Ocorreu um erro. Tente novamente.';
}
