// Helpers pra testes E2E — usa Better Auth (email/senha) em vez do token antigo.

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@tabelafin.local';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';
const TEST_NAME = process.env.TEST_NAME || 'Test User';

let userCreated = false;

/**
 * Garante que o usuário de teste existe (cria via API do Better Auth se necessário).
 * Chamado uma vez por sessão de teste.
 */
async function ensureTestUser(page: import('@playwright/test').Page) {
	if (userCreated) return;

	// Tenta registrar o usuário — se já existir, Better Auth lança erro, ignoramos
	await page.request.post('/api/auth/sign-up/email', {
		data: {
			name: TEST_NAME,
			email: TEST_EMAIL,
			password: TEST_PASSWORD
		}
	});

	userCreated = true;
}

/**
 * Faz login via Better Auth (email/senha) no formulário /login.
 */
export async function login(page: import('@playwright/test').Page) {
	await ensureTestUser(page);

	await page.goto('/login');
	await page.getByLabel('E-mail').fill(TEST_EMAIL);
	await page.getByLabel('Senha').fill(TEST_PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForURL('**/dashboard', { timeout: 30_000 });
}
