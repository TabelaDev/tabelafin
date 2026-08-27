<script lang="ts">
	import { handleAction } from '$lib/utils/forms';

	import { enhance } from '$app/forms';
	import { Button, Dialog, Input, Label } from '@tabeladev/tabelawebui';

	let {
		open = $bindable()
	}: {
		open: boolean;
	} = $props();

	let confirmation = $state('');
	const canSubmit = $derived(confirmation.trim().toUpperCase() === 'APAGAR');
</script>

<Dialog bind:open title="Apagar meus dados">
	<form
		id="erase-data-form"
		method="POST"
		action="?/eraseData"
		use:enhance={handleAction()}
		class="flex flex-col gap-4"
	>
		<p class="font-mono text-sm text-ink-soft">
			Isso apaga <strong>permanentemente</strong> suas transações, contas, categorias, tags, recorrências,
			relatórios, conversas e credenciais. Sua conta e login serão mantidos.
		</p>
		<p class="font-mono text-sm text-ink-soft">
			Se quiser guardar uma cópia, baixe seus dados antes.
		</p>

		<div class="flex flex-col gap-2">
			<Label for="confirmErase">
				Digite <span class="font-semibold">APAGAR</span> para confirmar
			</Label>
			<Input
				id="confirmErase"
				name="confirmErase"
				type="text"
				autocomplete="off"
				required
				bind:value={confirmation}
			/>
		</div>
	</form>

	{#snippet footerStart()}
		<Button type="button" size="sm" onclick={() => (open = false)}>Cancelar</Button>
	{/snippet}
	{#snippet footerEnd()}
		<Button type="submit" size="sm" variant="danger" form="erase-data-form" disabled={!canSubmit}>
			Apagar definitivamente
		</Button>
	{/snippet}
</Dialog>
