// The user-facing 401 guard for API routes. Two response shapes are both real
// contracts today, not accidental drift: the onboarding/pluggy/chat/account
// family returns `{ error }` JSON (read by OnboardingModal.svelte and
// ChatWidget.svelte), while the statements/push family throws via
// SvelteKit's error() helper, which serialises to `{ message }` (read by
// CsvImport.svelte, StatementUpload.svelte, StatementImportModal.svelte and
// statements/review/+page.svelte). Both guards share one message string so
// the wording can't drift between them, as it had for /api/chat.
import { error, json } from '@sveltejs/kit';

const UNAUTHENTICATED_MESSAGE = 'Não autenticado.';

/** For routes that return a `{ error }` JSON body on failure. */
export function unauthorizedJson() {
	return json({ error: UNAUTHENTICATED_MESSAGE }, { status: 401 });
}

/** For routes that throw via SvelteKit's error() helper. */
export function requireAuth(): never {
	error(401, UNAUTHENTICATED_MESSAGE);
}
