// Mapeamento de erros do Better Auth pra mensagens amigáveis ao usuário.
// Reutilizável — copie pra qualquer projeto.

export function friendlyAuthError(e: unknown): string {
	if (!(e instanceof Error)) return 'Ocorreu um erro inesperado.';

	const msg = e.message.toLowerCase();

	// Cadastro
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

	// Validação
	if (msg.includes('invalid email')) {
		return 'E-mail inválido.';
	}
	if (msg.includes('password too short') || msg.includes('password must be')) {
		return 'A senha deve ter pelo menos 8 caracteres.';
	}

	// Sessão
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

	// Fallback — nunca vazar erro interno
	return 'Ocorreu um erro. Tente novamente.';
}
