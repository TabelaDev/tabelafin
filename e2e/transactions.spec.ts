import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Cada teste cria a própria transação (banco isolado por rodada de teste —
// ver globalSetup) e busca por ela, então são independentes mesmo rodando em
// paralelo.
function uniqueDescription(prefix: string) {
	return `${prefix} ${Date.now()}`;
}

async function addTransaction(
	page: import('@playwright/test').Page,
	description: string,
	amount: string
) {
	await page.getByRole('link', { name: '+ Nova transação' }).click();
	await expect(page.getByRole('heading', { name: 'Nova Transação' })).toBeVisible();

	await page.getByLabel('Descrição').fill(description);
	await page.getByLabel('Valor (R$)').fill(amount);
	await page.getByRole('button', { name: 'Salvar' }).click();

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
}

test.describe('transações', () => {
	test('adiciona transação manual com categoria sugerida por regra', async ({ page }) => {
		await login(page);

		const description = uniqueDescription('iFood Pedido Teste');
		await addTransaction(page, description, '-45.90');

		// Confere na página de transações.
		await page.getByRole('link', { name: 'Transações' }).click();
		await expect(page.getByRole('heading', { name: 'Transações' })).toBeVisible();

		const search = page.getByPlaceholder('Buscar descrição...');
		await search.fill(description);
		// Confere a célula da tabela e a badge de categoria na mesma linha.
		await expect(page.getByRole('cell', { name: description }).first()).toBeVisible({
			timeout: 10_000
		});
		// iFood → regra sugere Alimentação.
		await expect(page.getByRole('cell', { name: 'Alimentação' }).first()).toBeVisible();
	});

	test('filtra transações por busca na página de transações', async ({ page }) => {
		await login(page);

		const description = uniqueDescription('Uber Corrida Teste');
		await addTransaction(page, description, '-28.40');

		await page.getByRole('link', { name: 'Transações' }).click();
		await expect(page.getByRole('heading', { name: 'Transações' })).toBeVisible();

		const search = page.getByPlaceholder('Buscar descrição...');
		await search.fill(description);
		await expect(page.getByRole('cell', { name: description }).first()).toBeVisible({
			timeout: 10_000
		});
	});
});
