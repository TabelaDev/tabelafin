<script lang="ts">
	import AiSetupForm from '$lib/components/Forms/AiSetupForm.svelte';

	import { Dialog } from '@tabelhadev/tabelhawebui';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog bind:open title="Configurar IA" size="lg">
	{#key open}
		<AiSetupForm
			onSuccess={() => (open = false)}
			secondaryLabel="Cancelar"
			onSecondary={() => (open = false)}
		/>
	{/key}
</Dialog>
