<script lang="ts">
	import PluggySetupForm from '$lib/components/Forms/PluggySetupForm.svelte';

	import { Dialog } from '@tabelhadev/tabelhawebui';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog bind:open title="Conectar Open Finance" size="lg">
	{#key open}
		<PluggySetupForm onSuccess={() => (open = false)} />
	{/key}
</Dialog>
