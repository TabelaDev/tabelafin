<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button, Input, Label, Select, DatePicker, TagInput } from '@tabeladev/tabelawebui';
	import type { PageData } from './$types';

	let {
		data,
		form
	}: {
		data: PageData;
		form?: { error?: string } | null;
	} = $props();
	let submitting = $state(false);
	let date = $state(new Date().toISOString().slice(0, 10));
	let tags = $state<string[]>([]);

	const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head>
	<title>Nova Transação — TabelaFin</title>
</svelte:head>

<div class="mx-auto max-w-md">
	<header class="mb-6">
		<h1 class="font-mono text-2xl font-bold">Nova Transação</h1>
		<p class="text-sm text-ink-soft">A categoria é sugerida automaticamente pela descrição.</p>
	</header>

	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ result }) => {
				await applyAction(result);
				submitting = false;
			};
		}}
		class="flex flex-col gap-4 border border-rule bg-paper-raised p-5"
	>
		<div class="flex flex-col gap-1.5">
			<Label for="date">Data</Label>
			<DatePicker id="date" name="date" bind:value={date} max={today} required />
		</div>

		<div class="flex flex-col gap-1.5">
			<Label for="description">Descrição</Label>
			<Input
				id="description"
				name="description"
				placeholder="Ex: mercado, aluguel, salário..."
				required
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<Label for="amount">Valor (R$)</Label>
			<Input id="amount" name="amount" type="number" step="0.01" placeholder="-50,00" required />
			<p class="text-xs text-ink-soft">Negativo pra gasto, positivo pra entrada.</p>
		</div>

		<div class="flex flex-col gap-1.5">
			<Label for="category">Categoria (opcional)</Label>
			<Select
				id="category"
				name="category"
				placeholder="Auto (sugerida pela descrição)"
				options={[
					{ value: '', label: 'Auto (sugerida pela descrição)' },
					...data.categories.map((cat) => ({ value: cat.name, label: cat.name }))
				]}
				filter
				filterPlaceholder="Buscar categoria…"
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<Label for="tags">Eventos (opcional, além da categoria)</Label>
			<TagInput
				id="tags"
				name="tags"
				bind:value={tags}
				options={data.userTags.map((t) => t.name)}
				placeholder="Ex.: Viagem SP, PC novo…"
			/>
			<p class="text-xs text-ink-soft">Agrupa gastos pontuais sem criar categoria.</p>
		</div>

		{#if form?.error}
			<p class="text-sm text-danger">{form.error}</p>
		{/if}

		<div class="mt-2 flex gap-2">
			<Button type="button" variant="ghost" onclick={() => goto(resolve('/dashboard'))}>
				Cancelar
			</Button>
			<Button type="submit" variant="primary" disabled={submitting}>
				{submitting ? 'Salvando…' : 'Salvar'}
			</Button>
		</div>
	</form>
</div>
