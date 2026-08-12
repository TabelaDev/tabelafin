<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button, Card, Input, Select } from '@tabeladev/tabelawebui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newName = $state('');
	let newColor = $state('ctp-overlay1');

	// One edit form per category — a single active row at a time.
	let editingName = $state<string | null>(null);
	let editName = $state('');
	let editColor = $state('ctp-overlay1');

	function startEdit(name: string, color: string) {
		editingName = name;
		editName = name;
		editColor = color;
	}

	function cancelEdit() {
		editingName = null;
	}

	// Colours arrive from the server already labelled for the dropdown ({ value, label }).
	const colorOptions = $derived(data.colorOptions);
	// The dot in its real colour: uses Catppuccin's global CSS variable through an
	// inline style (a dynamic Tailwind class `bg-${color}` is not compiled by the
	// JIT). `color` arrives as "ctp-peach" → --catppuccin-peach.
	const swatchStyle = (color: string) =>
		`background-color: var(--catppuccin-${color.replace('ctp-', '')});`;

	// Client-side search over the category list.
	let searchQuery = $state('');
	const filteredCategories = $derived(
		searchQuery.trim()
			? data.categories.filter((c) =>
					c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
				)
			: data.categories
	);
</script>

<svelte:head>
	<title>Categorias — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-wrap items-start justify-between gap-2">
		<div>
			<a href={resolve('/categories')} class="font-mono text-sm text-ink-soft hover:text-ink"
				>← Categorias</a
			>
			<h1 class="font-mono text-2xl font-bold">Gerenciar categorias</h1>
			<p class="font-mono text-sm text-ink-soft">
				<span class="text-ink-faint">//</span> Suas categorias de transação — crie, renomeie, mude a cor.
				As transações sem categoria aparecem como "Outros".
			</p>
		</div>
		<a href={resolve('/categories/rules')} class="font-mono text-xs text-accent hover:underline"
			>regras automáticas</a
		>
	</header>

	<!-- Nova categoria -->
	<Card>
		<form
			method="POST"
			action="?/add"
			use:enhance={() => {
				return async ({ result }) => {
					await applyAction(result);
					if (result.type === 'success') {
						newName = '';
						newColor = 'ctp-overlay1';
						await invalidateAll();
					}
				};
			}}
			class="flex flex-col gap-3"
		>
			<h2 class="font-mono text-sm font-semibold">Nova categoria</h2>
			<div class="flex flex-wrap items-center gap-2">
				<Input
					name="name"
					placeholder="Nome (ex.: Psicólogo)"
					bind:value={newName}
					class="w-56"
					required
				/>
				<Select name="color" options={colorOptions} bind:value={newColor} class="w-40" />
				<Button type="submit" variant="primary" disabled={!newName.trim()}>Adicionar</Button>
			</div>
		</form>
	</Card>

	<!-- Lista de categorias -->
	<Card>
		<div class="flex flex-col gap-2">
			<h2 class="font-mono text-sm font-semibold">Suas categorias</h2>
			<Input bind:value={searchQuery} placeholder="Buscar categoria…" />
			{#each filteredCategories as cat (cat.name)}
				<div
					class="flex items-center justify-between gap-3 border-b border-rule py-2 last:border-b-0"
				>
					<div class="flex items-center gap-2">
						<span class="inline-block size-3 rounded-full" style={swatchStyle(cat.color)}></span>
						<span class="font-mono text-sm">{cat.name}</span>
					</div>

					{#if editingName === cat.name}
						<form
							method="POST"
							action="?/update"
							use:enhance={() => {
								return async ({ result }) => {
									await applyAction(result);
									if (result.type === 'success') {
										cancelEdit();
										await invalidateAll();
									}
								};
							}}
							class="flex flex-wrap items-center gap-2"
						>
							<input type="hidden" name="name" value={cat.name} />
							<Input name="newName" bind:value={editName} class="w-44" required />
							<Select name="color" options={colorOptions} bind:value={editColor} class="w-36" />
							<Button type="submit" size="sm" variant="primary">Salvar</Button>
							<Button type="button" size="sm" variant="ghost" onclick={cancelEdit}>Cancelar</Button>
						</form>
					{:else}
						<div class="flex items-center gap-2">
							<Button size="sm" variant="outline" onclick={() => startEdit(cat.name, cat.color)}>
								Editar
							</Button>
							<form
								method="POST"
								action="?/remove"
								use:enhance={() => {
									return async ({ result }) => {
										await applyAction(result);
										if (result.type === 'success') await invalidateAll();
									};
								}}
							>
								<input type="hidden" name="name" value={cat.name} />
								<Button
									type="submit"
									size="sm"
									variant="ghost"
									class="text-ctp-red hover:text-ctp-red"
								>
									Excluir
								</Button>
							</form>
						</div>
					{/if}
				</div>
			{/each}

			{#if filteredCategories.length === 0}
				<p class="font-mono text-sm text-ink-soft">
					{data.categories.length === 0
						? 'Nenhuma categoria ainda.'
						: 'Nenhuma categoria encontrada para a busca.'}
				</p>
			{/if}
		</div>
	</Card>
</div>
