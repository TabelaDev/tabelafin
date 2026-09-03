<script lang="ts">
	import { AI_PROVIDERS, type AiProvider } from '$lib/utils/ai-providers';

	import { Button, Dialog, Input, Label, Select, toast } from '@tabelhadev/tabelhawebui';

	let {
		onSuccess,
		primaryLabel = 'Salvar',
		secondaryLabel,
		onSecondary,
		submitting = $bindable(false)
	}: {
		onSuccess?: () => void;
		primaryLabel?: string;
		secondaryLabel?: string;
		onSecondary?: () => void;
		submitting?: boolean;
	} = $props();

	let provider = $state<AiProvider>('deepseek');
	let model = $state<string>(AI_PROVIDERS.deepseek.models[0].id);
	let apiKey = $state('');
	let error = $state('');

	$effect(() => {
		const models = AI_PROVIDERS[provider].models;
		if (!models.some((m) => m.id === model)) model = models[0].id;
	});

	async function submit() {
		if (!apiKey.trim()) {
			error = 'Informe sua API key.';
			toast.error(error);
			return;
		}
		submitting = true;
		error = '';
		try {
			const res = await fetch('/api/onboarding/ai', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ provider, model, apiKey })
			});
			const data = (await res.json()) as { error?: string };
			if (!res.ok || data.error) {
				error = data.error ?? 'Não foi possível salvar. Tente novamente.';
				toast.error(error);
				return;
			}
			const providerLabel = AI_PROVIDERS[provider].label;
			toast.success(`IA configurada: ${providerLabel} com ${model} pronta para categorizar.`);
			onSuccess?.();
		} catch {
			error = 'Não foi possível salvar. Tente novamente.';
			toast.error(error);
		} finally {
			submitting = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	{#if error}
		<p class="text-sm text-danger">{error}</p>
	{/if}

	<div class="flex flex-col gap-2">
		<Label for="ai-setup-provider">Provedor</Label>
		<Select
			id="ai-setup-provider"
			bind:value={provider}
			options={Object.entries(AI_PROVIDERS).map(([key, info]) => ({
				value: key,
				label: info.label
			}))}
		/>
	</div>

	<div class="flex flex-col gap-2">
		<Label for="ai-setup-model">Modelo</Label>
		<Select
			id="ai-setup-model"
			bind:value={model}
			options={AI_PROVIDERS[provider].models.map((m) => ({
				value: m.id,
				label: m.supportsDocuments ? m.id : `${m.id} (sem upload de PDF)`
			}))}
			filter
			filterPlaceholder="Buscar modelo…"
		/>
	</div>

	<div class="flex flex-col gap-2">
		<Label for="ai-setup-key">API key</Label>
		<Input
			id="ai-setup-key"
			type="password"
			autocomplete="off"
			required
			placeholder="sk-..."
			bind:value={apiKey}
		/>
	</div>

	<Dialog.Actions>
		{#snippet start()}
			{#if secondaryLabel && onSecondary}
				<Button variant="ghost" onclick={onSecondary} disabled={submitting}>
					{secondaryLabel}
				</Button>
			{/if}
		{/snippet}
		{#snippet end()}
			<Button onclick={submit} disabled={submitting}>
				{submitting ? 'Salvando…' : primaryLabel}
			</Button>
		{/snippet}
	</Dialog.Actions>
</div>
