import { applyAction } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { toast } from '@tabeladev/tabelawebui';
import type { ActionResult } from '@sveltejs/kit';

/**
 * The single `use:enhance` handler for every form action in the app.
 *
 * Feedback used to be absent or ad hoc: most actions finished in complete
 * silence, a few rendered an inline error, and no action ever reported success.
 * This routes both outcomes through the toast system that was already wired up
 * (`sveltekit-flash-message` → `Toaster` in the root layout) but that only
 * `logout` ever used.
 *
 * Errors are toasted client-side rather than flashed from the server, because
 * `use:enhance` does NOT re-run the load functions on a `failure` — a flash cookie
 * set by the action would sit unread until the next navigation. Success does
 * invalidate, so a `setFlash` from the server arrives through the layout bridge
 * and can carry counts the client does not know ("12 transações categorizadas").
 */
export function handleAction(
	options: {
		/** Runs before the reload — clear the form, close the dialog, leave edit mode. */
		onSuccess?: () => void;
		/** Used when the action failed without an `error` message of its own. */
		fallbackError?: string;
	} = {}
) {
	return () =>
		async ({ result }: { result: ActionResult }) => {
			await applyAction(result);

			if (result.type === 'failure') {
				const message = result.data?.error;
				toast.error(
					typeof message === 'string' && message
						? message
						: (options.fallbackError ?? 'Não foi possível concluir a ação.')
				);
				return;
			}

			if (result.type === 'success') {
				options.onSuccess?.();
				await invalidateAll();
			}
		};
}
