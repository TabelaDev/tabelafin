import { execSync } from 'node:child_process';

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@tabelafin.local';

function d1(command: string) {
	execSync(`bunx wrangler d1 execute tabelafin-db --local --command "${command}"`, {
		stdio: 'inherit'
	});
}

// Clears the manual transactions left by earlier E2E runs (source='manual' is all
// the tests ever write — never data coming from Open Finance/PDF). The tests run
// against the local dev D1; an isolated D1 would only be worth it after sorting
// out the persistence-layout mismatch between adapter-cloudflare and the wrangler
// CLI.
export default async function globalSetup() {
	d1("DELETE FROM transactions WHERE source='manual'");

	// The test user is created through sign-up (helpers.ts), and ever since email
	// verification landed, logging in answered "E-mail ainda não verificado" — no
	// test could authenticate, so the whole suite failed at login instead of at
	// what it actually tests. There is no inbox here, so the verification is
	// stamped directly.
	// `seen_onboarding` for the same reason: a fresh user gets the onboarding
	// dialog, and its overlay swallows every click — Playwright reports
	// "twui-dialog-overlay subtree intercepts pointer events" on elements that are
	// otherwise visible and enabled.
	d1(`UPDATE user SET emailVerified = 1, seen_onboarding = 1 WHERE email = '${TEST_EMAIL}'`);

	// Login rate limit: SIGN_IN_RULE allows 8 attempts per 15 minutes
	// (src/lib/server/rate-limit.ts) and the suite logs in once per test, so it
	// locked itself out from the ninth on. The counter lives in the local KV.
	execSync(
		`bunx wrangler kv key list --binding SESSIONS --local 2>/dev/null | ` +
			`grep -o '"ratelimit:[^"]*"' | tr -d '"' | ` +
			`xargs -r -I{} bunx wrangler kv key delete --binding SESSIONS --local "{}"`,
		{ stdio: 'inherit', shell: '/bin/bash' }
	);
}
