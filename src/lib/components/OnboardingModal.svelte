<script lang="ts">
	import AiSetupForm from '$lib/components/Forms/AiSetupForm.svelte';
	import PluggySetupForm from '$lib/components/Forms/PluggySetupForm.svelte';
	import { closeOnboarding, onboarding } from '$lib/stores/onboarding-store';

	import { invalidateAll } from '$app/navigation';
	import { Dialog, Stepper } from '@tabeladev/tabelawebui';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	const ITEMS = [
		{ value: 'ai', label: 'IA' },
		{ value: 'pluggy', label: 'Open Finance' }
	];

	let { autoOpen = false }: { autoOpen?: boolean } = $props();

	let open = $state(false);
	let step = $state<'ai' | 'pluggy'>('ai');
	let busy = $state(false);

	const stepperItems = $derived(ITEMS.map((item) => ({ ...item, disabled: busy })));

	// Kept in step with the store (profile and layout open the modal through it).
	$effect(() => {
		const unsubscribe = onboarding.subscribe((s) => {
			open = s.open;
			if (s.open) step = s.step;
		});
		return unsubscribe;
	});

	// If the Dialog closed through X/Esc/overlay (bind:open -> false), hand the
	// state back to the store so the two do not disagree ({ open: true } in the
	// store with the modal closed on screen).
	$effect(() => {
		if (!open) {
			const current = get(onboarding);
			if (current.open) closeOnboarding();
		}
	});

	// First visit: opens on its own.
	onMount(() => {
		if (autoOpen) onboarding.set({ open: true, step: 'ai' });
	});

	async function finish() {
		closeOnboarding();
		await invalidateAll();
	}
</script>

<Dialog bind:open title="Configurar TabelaFin" size="lg">
	<div class="mb-4">
		<Stepper items={stepperItems} bind:value={step} />
	</div>

	{#if step === 'ai'}
		<AiSetupForm
			bind:submitting={busy}
			primaryLabel="Continuar"
			secondaryLabel="Pular"
			onSecondary={() => (step = 'pluggy')}
			onSuccess={() => (step = 'pluggy')}
		/>
	{:else}
		<PluggySetupForm bind:submitting={busy} skippable onSuccess={finish} />
	{/if}
</Dialog>
