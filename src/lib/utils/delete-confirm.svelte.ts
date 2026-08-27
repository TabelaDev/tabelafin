// Delete-confirmation flow shared by the "manage" CRUD screens (categories,
// tags): the row's "Excluir" button only opens a dialog; confirming submits
// the row's own `?/remove` form (already wired via use:enhance) instead of
// building a new request. Dismissing the dialog by X/Esc/overlay cancels —
// call `syncClosed()` from an `$effect` watching `open` to clear the pending
// target in that case.
export class DeleteConfirm<T> {
	open = $state(false);
	pending = $state<(T & { form: HTMLFormElement }) | null>(null);

	start(payload: T, form: HTMLFormElement): void {
		this.pending = { ...payload, form };
		this.open = true;
	}

	/**
	 * Submits the pending row's form. `beforeSubmit` lets a caller mutate the
	 * form just before it submits — categories/manage uses it to carry the
	 * chosen migration target into a hidden input.
	 */
	confirm(beforeSubmit?: (pending: T & { form: HTMLFormElement }) => void): void {
		if (!this.pending) return;
		beforeSubmit?.(this.pending);
		this.pending.form.requestSubmit();
		this.pending = null;
		this.open = false;
	}

	cancel(): void {
		this.pending = null;
		this.open = false;
	}

	/** Call from `$effect(() => deleteConfirm.syncClosed())`. */
	syncClosed(): void {
		if (!this.open) this.pending = null;
	}
}
