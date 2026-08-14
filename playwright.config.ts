import { defineConfig, devices } from '@playwright/test';

const PORT = 5175;

export default defineConfig({
	testDir: './e2e',
	// Tests share the same dev server (webServer) and the same local D1;
	// running with multiple workers causes intermittent login/navigation failures
	// due to race conditions (the full suite runs in ~18s with 1 worker, so
	// parallelism isn't worth it).
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
