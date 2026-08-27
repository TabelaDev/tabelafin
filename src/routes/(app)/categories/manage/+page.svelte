<script lang="ts">
	import { DeleteConfirm } from '$lib/utils/delete-confirm.svelte';
	import { handleAction } from '$lib/utils/forms';

	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Card, Dialog, Input, Label, Page, Select } from '@tabeladev/tabelawebui';

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
	const deleteConfirm = new DeleteConfirm<{ name: string }>();
	let deleteMigrateTo = $state('');

	const migrationOptions = $derived(
		data.categories
			.filter((c) => c.name !== deleteConfirm.pending?.name)
			.map((c) => ({ value: c.name, label: c.name }))
	);

	function openDelete(name: string, form: HTMLFormElement) {
		deleteMigrateTo = '';
		deleteConfirm.start({ name }, form);
	}

	function confirmDelete() {
		deleteConfirm.confirm((pending) => {
			// Carry the chosen target into the row's form (a hidden input exists on
			// every `?/remove` form, left empty by default).
			const hidden = pending.form.querySelector<HTMLInputElement>('input[name="migrateTo"]');
			if (hidden) hidden.value = deleteMigrateTo;
		});
	}

	// Dismissing the dialog by X/Esc/overlay cancels the deletion (clears the
	// pending target so it is not submitted later).
	$effect(() => deleteConfirm.syncClosed());

	const handleRemove = handleAction();
</script>

<svelte:head>
	<title>Categorias: TabelaFin</title>
</svelte:head>

<Page.Shell>
	<header>
		<a href={resolve('/categories')} class="font-mono text-sm text-ink-soft hover:text-ink"
			>← Categorias</a
		>
	</header>
	<Page.Header
		title="Gerenciar categorias"
		subtitle="Suas categorias de transação: crie, renomeie, mude a cor. As transações sem categoria aparecem como 'Outros'."
	>
		{#snippet action()}
			<a href={resolve('/categories/rules')} class="font-mono text-xs text-accent hover:underline"
				>regras automáticas</a
			>
		{/snippet}
	</Page.Header>

	<!-- New category -->
	<Card>
		<Card.Header>
			<Card.Title>Nova categoria</Card.Title>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				action="?/add"
				use:enhance={handleAction({
					onSuccess: () => {
						newName = '';
						newColor = 'ctp-overlay1';
					}
				})}
				class="flex flex-col gap-3"
			>
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
		<Card.Header>
			<Card.Title>Suas categorias</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-col gap-2">
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
								use:enhance={handleAction({ onSuccess: cancelEdit })}
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
</Page.Shell>

<Dialog bind:open={deleteConfirm.open} title="Excluir categoria?" size="lg">
	<div class="flex flex-col gap-3">
		<p class="text-justify font-mono text-sm text-ink-soft">
			Excluir a categoria <span class="text-ink">{deleteConfirm.pending?.name}</span>? As transações
			que a usam <strong>não são apagadas</strong>.
		</p>

		<div class="flex flex-col gap-2">
			<Label for="migrateTo">Para onde mover as transações (e regras)?</Label>
			<Select
				id="migrateTo"
				name="migrateTo"
				options={[
					{ value: '', label: 'Não mover: transações viram "Outros"' },
					...migrationOptions
				]}
				bind:value={deleteMigrateTo}
				filter
				filterPlaceholder="Buscar categoria…"
			/>
			<p class="font-mono text-xs text-ink-faint">
				Mover repassa transações e regras automáticas pra outra categoria.
			</p>
		</div>
	</div>
	{#snippet footerStart()}
		<Button variant="ghost" onclick={() => deleteConfirm.cancel()}>Cancelar</Button>
	{/snippet}
	{#snippet footerEnd()}
		<Button variant="danger" onclick={confirmDelete}>Excluir</Button>
	{/snippet}
</Dialog>
