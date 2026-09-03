import { type Page, expect, test } from '@playwright/test';

// Exercised on the landing page: the ThemeToggle is the very same component the
// signed-in AppShell renders, and here it needs no login.
const ROOT = '/';

const rootClass = async (page: Page) => (await page.locator('html').getAttribute('class')) ?? '';
const isDark = async (page: Page) => (await rootClass(page)).includes('dark');

function themeToggle(page: Page) {
	// The accessible name comes from aria-label ("Usar tema escuro"), which is
	// lower-case, while the visible label is "Tema escuro" — hence the `i` flag.
	return page.getByRole('button', { name: /tema (claro|escuro)/i });
}

/**
 * Clicks the toggle and waits for the root class to actually flip.
 *
 * A plain click can land before hydration has attached the handler, in which case
 * it silently does nothing. Retrying until the class flips is what a fixed
 * `waitForTimeout` used to stand in for; the guard makes it idempotent, so a click
 * that did land is never undone by the next attempt.
 */
async function toggleTheme(page: Page) {
	const before = await isDark(page);
	await expect(async () => {
		if ((await isDark(page)) === before) await themeToggle(page).click();
		expect(await isDark(page)).toBe(!before);
	}).toPass({ timeout: 15_000, intervals: [200, 400, 800, 1500] });
	return !before;
}

test.describe('tema', () => {
	// The regression this guards: the theme used to be decided only on hydration,
	// so every reload painted light first and flipped to dark a frame later. The
	// inline script in app.html now resolves it before the first paint — and it
	// only works if the CSP nonce reaches it, which is easy to break silently.
	test('resolve antes do primeiro paint, sem violar o CSP', async ({ page }) => {
		const violations: string[] = [];
		page.on('console', (msg) => {
			if (/Refused to execute inline script/i.test(msg.text())) violations.push(msg.text());
		});

		const response = await page.goto(ROOT);
		const html = (await response?.text()) ?? '';

		// The script has to be inside <head>, ahead of SvelteKit's own head block.
		const headEnd = html.indexOf('</head>');
		const scriptAt = html.indexOf("localStorage.getItem('theme')");
		expect(scriptAt).toBeGreaterThan(-1);
		expect(scriptAt).toBeLessThan(headEnd);
		// A nonce that stayed as the literal placeholder means no substitution
		// happened and the CSP would reject the script.
		expect(html).not.toContain('nonce="%sveltekit');

		// Resolved before hydration: whichever theme it picked, the class is set.
		await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
		expect(violations).toEqual([]);
	});

	test('alterna entre claro e escuro', async ({ page }) => {
		await page.goto(ROOT);
		await expect(themeToggle(page)).toBeVisible();

		const nowDark = await toggleTheme(page);

		// The label names the action, not the current theme: on dark it offers to go
		// light. Asserted on aria-label rather than text because the header renders
		// the toggle icon-only — the visible label is opt-in (`showLabel`, which the
		// sidebar passes and this page does not).
		await expect(themeToggle(page)).toHaveAttribute(
			'aria-label',
			nowDark ? 'Usar tema claro' : 'Usar tema escuro'
		);
		// data-theme has to follow the class, or the tabelhawebui tokens and the
		// native controls stay on the previous theme.
		await expect(page.locator('html')).toHaveAttribute('data-theme', nowDark ? 'dark' : 'light');
	});

	// The choice used to be written to localStorage by the toggle and then ignored:
	// mode-watcher recomputed from the OS preference out of its own, never-written
	// key, so a reload always threw the choice away.
	test('a escolha persiste depois do reload', async ({ page }) => {
		await page.goto(ROOT);
		await expect(themeToggle(page)).toBeVisible();

		const chosenDark = await toggleTheme(page);
		await page.reload();

		expect(await isDark(page)).toBe(chosenDark);
	});
});
