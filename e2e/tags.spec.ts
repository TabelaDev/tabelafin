import { test, expect, type Page, type Locator } from '@playwright/test';
import { login } from './helpers';

// Unique per run so a leftover row from an interrupted run never collides.
const suffix = `${process.pid}${Math.floor(Math.random() * 1000)}`;
const TAG = `e2etag${suffix}`;
const RULE_DESCRIPTION = `e2eregra${suffix}`;

// `.last()`: toasts stack, and an earlier one is often still on screen when the
// next action fires.
const toast = (page: Page) => page.locator('.twui-toast-message').last();

/**
 * Fills an input and waits until the submit button reacts to it.
 *
 * `fill` can land before hydration, and the value it writes is then invisible to
 * the Svelte binding — the button stays disabled forever. Retrying until the
 * button enables is what makes this deterministic without a fixed wait.
 */
async function fillAndSubmit(input: Locator, value: string, submit: Locator) {
	await expect(async () => {
		await input.fill(value);
		await expect(submit).toBeEnabled({ timeout: 500 });
	}).toPass({ timeout: 15_000, intervals: [200, 400, 800] });
	await submit.click();
}

/**
 * Types into a client-side search box and waits for the list to actually narrow.
 *
 * Same hydration caveat as `fillAndSubmit`: a `fill` that lands before the
 * binding is live leaves the list unfiltered, and the row buttons stay ambiguous.
 */
async function searchFor(page: Page, placeholder: string, term: string, expected: Locator) {
	await expect(async () => {
		await page.getByPlaceholder(placeholder).fill(term);
		await expect(expected).toHaveCount(1, { timeout: 500 });
	}).toPass({ timeout: 15_000, intervals: [200, 400, 800] });
}

test.describe('tags', () => {
	// /tags used to be one page holding the summary, the CRUD and a hand-rolled
	// rules list. It is now split like /categories: overview here, CRUD in
	// /tags/manage, rules in /tags/rules.
	test('a visão geral aponta para gerenciar e para as regras', async ({ page }) => {
		await login(page);
		await page.goto('/tags');

		await expect(page.locator('h1')).toHaveText('Tags');
		await expect(
			page.getByRole('link', { name: /Crie, renomeie ou exclua suas tags/ })
		).toBeVisible();
		await expect(page.getByRole('link', { name: /Marque transações com tags/ })).toBeVisible();

		// The rules form is gone from this page — that was the inconsistency.
		await expect(page.getByLabel('Descrição')).toHaveCount(0);
	});

	test('cria e exclui uma tag, com toast em cada passo', async ({ page }) => {
		await login(page);
		await page.goto('/tags/manage');

		const nameInput = page.getByPlaceholder('Ex.: Viagem SP, PC novo…');
		const addButton = page.getByRole('button', { name: 'Adicionar' });

		await fillAndSubmit(nameInput, TAG, addButton);
		await expect(toast(page)).toContainText(`Tag "${TAG}" criada`);

		// Duplicate: the action fails and the message finally reaches the user —
		// before this, tags/+page.svelte never took `form`, so every fail() was
		// rendered nowhere.
		await fillAndSubmit(nameInput, TAG, addButton);
		await expect(toast(page)).toContainText(`A tag "${TAG}" já existe`);

		// Narrow to the one row, so "Excluir" is unambiguous.
		const removeButton = page.getByRole('button', { name: 'Excluir' });
		await searchFor(page, 'Buscar tag…', TAG, removeButton);
		await removeButton.click();
		await page.getByRole('button', { name: 'Excluir' }).last().click();
		await expect(toast(page)).toContainText('excluída');
	});

	test('as regras de tag têm tabela, busca e coluna de data, como as de categoria', async ({
		page
	}) => {
		await login(page);

		// A rule needs a tag to point at.
		await page.goto('/tags/manage');
		await fillAndSubmit(
			page.getByPlaceholder('Ex.: Viagem SP, PC novo…'),
			TAG,
			page.getByRole('button', { name: 'Adicionar' })
		);
		await expect(toast(page)).toContainText('criada');

		await page.goto('/tags/rules');
		await expect(page.getByRole('heading', { name: 'Regras automáticas' })).toBeVisible();
		// The three things the inline list on /tags never had.
		await expect(page.getByPlaceholder('Buscar descrição ou tag…')).toBeVisible();
		await expect(page.getByRole('columnheader', { name: 'Criada em' })).toBeVisible();
		await expect(page.getByRole('columnheader', { name: 'Descrição' })).toBeVisible();

		const description = page.getByLabel('Descrição');
		const addButton = page.getByRole('button', { name: 'Adicionar' });
		await expect(async () => {
			await description.fill(RULE_DESCRIPTION);
			await page.getByLabel('Tags').fill(TAG);
			await page.keyboard.press('Enter');
			await expect(addButton).toBeEnabled({ timeout: 500 });
		}).toPass({ timeout: 15_000, intervals: [200, 400, 800] });
		await addButton.click();

		// The backfill count is the part that used to happen silently.
		await expect(toast(page)).toContainText(`Regra criada para "${RULE_DESCRIPTION}"`);
		await expect(page.getByRole('cell', { name: RULE_DESCRIPTION })).toBeVisible();

		// Search narrows the table.
		const ruleCell = page.getByRole('cell', { name: RULE_DESCRIPTION });
		await searchFor(page, 'Buscar descrição ou tag…', RULE_DESCRIPTION, ruleCell);
		await page.getByPlaceholder('Buscar descrição ou tag…').fill('naoexistenadaassim');
		await expect(ruleCell).toHaveCount(0);
		await searchFor(page, 'Buscar descrição ou tag…', RULE_DESCRIPTION, ruleCell);

		// Clean up: rule first, then the tag it referenced.
		await page.getByRole('button', { name: 'Excluir' }).click();
		await expect(toast(page)).toContainText(`Regra de "${RULE_DESCRIPTION}" excluída`);

		await page.goto('/tags/manage');
		const removeTag = page.getByRole('button', { name: 'Excluir' });
		await searchFor(page, 'Buscar tag…', TAG, removeTag);
		await removeTag.click();
		await page.getByRole('button', { name: 'Excluir' }).last().click();
		await expect(toast(page)).toContainText('excluída');
	});
});
