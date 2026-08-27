import { expect, test } from '@playwright/test';

import { login } from './helpers';

test.describe('autenticação', () => {
	test('redireciona pro login sem sessão', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page.getByLabel('E-mail')).toBeVisible();
	});

	test('credenciais inválidas mostram erro', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('E-mail').fill('wrong@email.com');
		await page.getByLabel('Senha').fill('wrongpassword');
		await page.getByRole('button', { name: 'Entrar' }).click();
		await expect(page.getByText('Credenciais inválidas')).toBeVisible();
	});

	test('login válido leva ao dashboard', async ({ page }) => {
		await login(page);
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	});

	test('logout volta pro login', async ({ page }) => {
		await login(page);
		await page.getByRole('button', { name: 'Sair' }).click();
		await expect(page.getByLabel('E-mail')).toBeVisible({ timeout: 10_000 });
	});
});
