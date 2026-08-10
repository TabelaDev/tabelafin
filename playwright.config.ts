import { defineConfig, devices } from '@playwright/test';

const PORT = 5175;

export default defineConfig({
	testDir: './e2e',
	// Os testes compartilham o mesmo dev server (webServer) e o mesmo D1 local;
	// rodar com vários workers causa falhas intermitentes de login/navegação por
	// competição (a suíte inteira roda em ~18s com 1 worker, então não vale o
	// paralelismo).
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: 'list',
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `bun run dev -- --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000
	}
});
