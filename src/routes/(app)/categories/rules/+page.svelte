<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import { Button, Card, Input, Select, Table } from '@tabeladev/tabelawebui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Form for a brand-new rule — description + category, typed directly.
	let newDescription = $state('');
	let newCategory = $state('');

	// One row in edit mode at a time, same as the categories page next door.
	let editingId = $state<string | null>(null);
	let editCategory = $state('');

	function startEdit(id: string, category: string) {
		editingId = id;
		editCategory = category;
	}

	function cancelEdit() {
		editingId = null;
	}

	const categoryOptions = $derived(data.categories.map((c) => ({ value: c.name, label: c.name })));

	const categoryColor = (name: string) =>
		data.categories.find((c) => c.name === name)?.color ?? 'ctp-overlay1';

	// Client-side search, like the categories page — no page reload per keystroke.
	let searchQuery = $state('');
	const filteredRules = $derived(
		searchQuery.trim()
			? data.rules.filter((r) =>
					`${r.description} ${r.category}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
				)
			: data.rules
	);

	// `createdAt` goes in as a timestamp so the Table sorts it chronologically —
	// a pre-formatted date sorts alphabetically by month name.
	const rows = $derived(
		filteredRules.map((rule) => ({
			id: rule.id,
			description: rule.description,
			category: rule.category,
			createdAt: new Date(rule.createdAt).getTime()
		}))
	);

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString('pt-BR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Regras automáticas — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header>
		<a href={resolve('/categories/manage')} class="font-mono text-sm text-ink-soft hover:text-ink"
			>← Gerenciar categorias</a
		>
		<h1 class="font-mono text-2xl font-bold">Regras automáticas</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span> Cada regra guarda uma descrição e a categoria que ela recebe.
			Transações novas com a mesma descrição já entram categorizadas.
		</p>
	</header>

	<!-- Nova regra -->
	<Card>
		<Card.Content>
			<form
				method="POST"
				action="?/add"
				use:enhance={() => {
					return async ({ result }) => {
						await applyAction(result);
						if (result.type === 'success') {
							newDescription = '';
							newCategory = '';
							await invalidateAll();
						}
					};
				}}
				class="flex flex-col gap-3"
			>
				<h2 class="font-mono text-sm font-semibold">Nova regra</h2>
				<div class="flex flex-wrap items-center gap-2">
					<Input
						name="description"
						placeholder="Descrição (ex.: Transferência recebida do Ensino Ágil)"
						bind:value={newDescription}
						class="w-72"
						required
					/>
					<Select
						name="category"
						options={categoryOptions}
						bind:value={newCategory}
						class="w-44"
						filter
						filterPlaceholder="Buscar categoria…"
					/>
					<Button type="submit" variant="primary" disabled={!newDescription.trim() || !newCategory}>
						Adicionar
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card>

	<Card>
		<Card.Content>
			<div class="flex flex-col gap-3">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="font-mono text-sm font-semibold">
						{data.rules.length}
						{data.rules.length === 1 ? 'regra' : 'regras'}
					</h2>
					<Input
						bind:value={searchQuery}
						placeholder="Buscar descrição ou categoria…"
						class="w-64"
					/>
				</div>

				<div class="border border-rule bg-paper-raised">
					<Table
						columns={[
							{ key: 'description', label: 'Descrição', sortable: true },
							{ key: 'category', label: 'Categoria', sortable: true },
							{ key: 'createdAt', label: 'Criada em', sortable: true },
							{ key: 'actions', label: '' }
						]}
						{rows}
						widths={[4, 2, 2, 2]}
						rowKey="id"
						pageSize={25}
						pageSizeOptions={[10, 25, 50]}
					>
						{#snippet cell(row: Record<string, unknown>, key: string)}
							{#if key === 'description'}
								<span class="font-mono text-xs">{row.description}</span>
							{:else if key === 'category'}
								{#if editingId === row.id}
									<Select
										options={categoryOptions}
										bind:value={editCategory}
										class="w-44"
										filter
										filterPlaceholder="Buscar categoria…"
									/>
								{:else}
									<CategoryBadge
										category={String(row.category)}
										color={categoryColor(String(row.category))}
									/>
								{/if}
							{:else if key === 'createdAt'}
								<span class="text-xs text-ink-soft">{formatDate(Number(row.createdAt))}</span>
							{:else if key === 'actions'}
								<div class="flex items-center justify-end gap-2">
									{#if editingId === row.id}
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
										>
											<input type="hidden" name="description" value={row.description} />
											<input type="hidden" name="category" value={editCategory} />
											<Button type="submit" size="sm" variant="primary">Salvar</Button>
										</form>
										<Button type="button" size="sm" variant="ghost" onclick={cancelEdit}>
											Cancelar
										</Button>
									{:else}
										<Button
											size="sm"
											variant="outline"
											onclick={() => startEdit(String(row.id), String(row.category))}
										>
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
											<input type="hidden" name="id" value={row.id} />
											<Button
												type="submit"
												size="sm"
												variant="ghost"
												class="text-ctp-red hover:text-ctp-red"
											>
												Excluir
											</Button>
										</form>
									{/if}
								</div>
							{/if}
						{/snippet}
						{#snippet empty()}
							<p class="py-12 text-center font-mono text-sm text-ink-soft">
								{data.rules.length === 0
									? 'Nenhuma regra ainda. Elas são criadas quando você categoriza uma transação.'
									: 'Nenhuma regra encontrada para a busca.'}
							</p>
						{/snippet}
					</Table>
				</div>
			</div>
		</Card.Content>
	</Card>
</div>
