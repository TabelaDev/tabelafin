import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('dashboard', () => {
	test('carrega cards de resumo e navegação', async ({ page }) => {
		await login(page);
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
		await expect(page.getByText('Saldo total', { exact: true })).toBeVisible();
		await expect(page.getByText('Gastos do mês', { exact: true })).toBeVisible();
		await expect(page.getByText('Receitas do mês', { exact: true })).toBeVisible();
		await expect(page.getByText('Investimentos', { exact: true })).toBeVisible();
	});

	test('navega pela sidebar entre páginas', async ({ page }) => {
		await login(page);

		await page.getByRole('link', { name: 'Transações' }).click();
		await expect(page.getByRole('heading', { name: 'Transações' })).toBeVisible();

		await page.getByRole('link', { name: 'Categorias' }).click();
		await expect(page.getByRole('heading', { name: 'Categorias' })).toBeVisible();

		await page.getByRole('link', { name: 'Perfil' }).click();
		await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();

		await page.getByRole('link', { name: 'Dashboard' }).click();
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	});

	test('renderiza os gráficos ApexCharts', async ({ page }) => {
		await login(page);

		// Cria uma transação pra garantir que haja dados de gasto e o gráfico
		// de barras/donut renderize (banco isolado começa vazio).
		await page.getByRole('link', { name: '+ Nova transação' }).click();
		await expect(page.getByRole('heading', { name: 'Nova Transação' })).toBeVisible();
		await page.getByLabel('Descrição').fill('Mercado Teste Grafico');
		await page.getByLabel('Valor (R$)').fill('-120.00');
		await page.getByRole('button', { name: 'Salvar' }).click();
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });

		await expect(page.locator('.apexcharts-canvas').first()).toBeVisible({ timeout: 10_000 });
	});

	// O teste do tema vive em theme.spec.ts: o ThemeToggle é o mesmo componente na
	// landing, e lá ele não depende do login.
});
