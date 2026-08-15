<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ActionResult } from '@sveltejs/kit';
	import { Button, Card, Dialog, Input, Label, Select } from '@tabeladev/tabelawebui';
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
	// JIT). `color` arrives as "ctp-peach" → --ctp-peach.
	const swatchStyle = (color: string) =>
		`background-color: var(--ctp-${color.replace('ctp-', '')});`;

	// Client-side search over the category list.
	let searchQuery = $state('');
	const filteredCategories = $derived(
		searchQuery.trim()
			? data.categories.filter((c) =>
					c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
				)
			: data.categories
	);

	// Delete confirmation — the "Excluir" button only opens the dialog; the
	// confirm button submits the row's own `?/remove` form. The dialog can also
	// migrate the category's transactions + rules to another one.
	let showDeleteDialog = $state(false);
	let pendingDelete = $state<{ name: string; form: HTMLFormElement } | null>(null);
	let deleteMigrateTo = $state('');

	const migrationOptions = $derived(
		data.categories
			.filter((c) => c.name !== pendingDelete?.name)
			.map((c) => ({ value: c.name, label: c.name }))
	);

	function openDelete(name: string, form: HTMLFormElement) {
		pendingDelete = { name, form };
		deleteMigrateTo = '';
		showDeleteDialog = true;
	}

	function confirmDelete() {
		const form = pendingDelete?.form;
		// Carry the chosen target into the row's form (a hidden input exists on
		// every `?/remove` form, left empty by default).
		const hidden = form?.querySelector<HTMLInputElement>('input[name="migrateTo"]');
		if (hidden) hidden.value = deleteMigrateTo;
		form?.requestSubmit();
		pendingDelete = null;
		showDeleteDialog = false;
	}

	// Dismissing the dialog by X/Esc/overlay cancels the deletion (clears the
	// pending target so it is not submitted later).
	$effect(() => {
		if (!showDeleteDialog) pendingDelete = null;
	});

	// Reuses `use:enhance` + `applyAction` so the `?/remove` action result is
	// applied and the list is invalidated after a successful deletion.
	const handleRemove = () => {
		return async ({ result }: { result: ActionResult }) => {
			await applyAction(result);
			if (result.type === 'success') await invalidateAll();
		};
	};
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

	<!-- New category -->
	<Card>
		<Card.Content>
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
		</Card.Content>
	</Card>

	<!-- Category list -->
	<Card>
		<Card.Content>
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
								<Button type="button" size="sm" variant="ghost" onclick={cancelEdit}
									>Cancelar</Button
								>
							</form>
						{:else}
							<div class="flex items-center gap-2">
								<Button size="sm" variant="outline" onclick={() => startEdit(cat.name, cat.color)}>
									Editar
								</Button>
								<form method="POST" action="?/remove" use:enhance={handleRemove}>
									<input type="hidden" name="name" value={cat.name} />
									<input type="hidden" name="migrateTo" />
									<Button
										type="button"
										size="sm"
										variant="ghost"
										class="text-ctp-red hover:text-ctp-red"
										onclick={(e) =>
											openDelete(
												cat.name,
												(e.currentTarget as HTMLElement).closest('form') as HTMLFormElement
											)}
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
		</Card.Content>
	</Card>
</div>

<Dialog bind:open={showDeleteDialog} title="Excluir categoria?" size="lg">
	<div class="flex flex-col gap-3">
		<p class="text-justify font-mono text-sm text-ink-soft">
			Excluir a categoria <span class="text-ink">{pendingDelete?.name}</span>? As transações que a
			usam <strong>não são apagadas</strong>.
		</p>

		<div class="flex flex-col gap-2">
			<Label for="migrateTo">Para onde mover as transações (e regras)?</Label>
			<Select
				id="migrateTo"
				name="migrateTo"
				options={[
					{ value: '', label: 'Não mover — transações viram "Outros"' },
					...migrationOptions
				]}
				bind:value={deleteMigrateTo}
			/>
			<p class="font-mono text-xs text-ink-faint">
				Mover repassa transações e regras automáticas pra outra categoria.
			</p>
		</div>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (showDeleteDialog = false)}>Cancelar</Button>
		<Button variant="danger" onclick={confirmDelete}>Excluir</Button>
	{/snippet}
</Dialog>
