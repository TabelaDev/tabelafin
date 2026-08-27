<script lang="ts">
	import { handleAction } from '$lib/utils/forms';

	import { enhance } from '$app/forms';
	import { Button, Dialog, Input, Label } from '@tabeladev/tabelawebui';

	let {
		open = $bindable(),
		email
	}: {
		open: boolean;
		email: string;
	} = $props();
</script>

<Dialog bind:open title="Excluir minha conta">
	<form
		id="delete-account-form"
		method="POST"
		action="?/deleteAccount"
		use:enhance={handleAction()}
		class="flex flex-col gap-4"
	>
		<p class="font-mono text-sm text-ink-soft">
			Isso apaga <strong>permanentemente</strong> suas transações, contas, categorias, tags, recorrências,
			relatórios, conversas e credenciais. Não dá pra desfazer.
		</p>
		<p class="font-mono text-sm text-ink-soft">
			Se quiser guardar uma cópia, baixe seus dados antes.
		</p>

		<div class="flex flex-col gap-2">
			<Label for="confirmEmail">
				Digite <span class="font-semibold">{' ' + email + ' '}</span> para confirmar
			</Label>
			<Input id="confirmEmail" name="confirmEmail" type="email" autocomplete="off" required />
		</div>
	</form>

	{#snippet footerStart()}
		<Button type="button" size="sm" onclick={() => (open = false)}>Cancelar</Button>
	{/snippet}
	{#snippet footerEnd()}
		<Button type="submit" size="sm" variant="danger" form="delete-account-form">
			Excluir definitivamente
		</Button>
	{/snippet}
</Dialog>
