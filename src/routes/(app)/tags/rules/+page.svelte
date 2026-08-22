<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Badge, Button, Card, Input, Label, Table, TagInput } from '@tabeladev/tabelawebui';
	import { handleAction } from '$lib/utils/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Form for a brand-new rule — description + the tags it applies.
	let newDescription = $state('');
	let newTags = $state<string[]>([]);

	// One row in edit mode at a time, same as the categories rules page.
	let editingDescription = $state<string | null>(null);
	let editTags = $state<string[]>([]);

	function startEdit(description: string, tagNames: string[]) {
		editingDescription = description;
		editTags = [...tagNames];
	}

	function cancelEdit() {
		editingDescription = null;
	}

	function clearNewForm() {
		newDescription = '';
		newTags = [];
	}

	// Client-side search, like the categories rules page — no page reload per
	// keystroke.
	let searchQuery = $state('');
	const filteredRules = $derived(
		searchQuery.trim()
			? data.rules.filter((r) =>
					`${r.description} ${r.tagNames.join(' ')}`
						.toLowerCase()
						.includes(searchQuery.trim().toLowerCase())
				)
			: data.rules
	);

	// `createdAt` goes in as a timestamp so the Table sorts it chronologically —
	// a pre-formatted date sorts alphabetically by month name. The row key is the
	// description, not an id: one rule is the whole set of tags for a description,
	// and the table has one row per description.
	const rows = $derived(
		filteredRules.map((rule) => ({
			description: rule.description,
			tagNames: rule.tagNames,
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
	<title>Regras de tag: TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header>
		<a href={resolve('/tags/manage')} class="font-mono text-sm text-ink-soft hover:text-ink"
			>← Gerenciar tags</a
		>
		<h1 class="font-mono text-2xl font-bold">Regras automáticas</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span> Cada regra guarda uma descrição e as tags que ela recebe.
			Vale pras transações novas e também pras antigas com a mesma descrição.
		</p>
	</header>

	<!-- New rule -->
	<Card>
		<Card.Content>
			<form
				method="POST"
				action="?/add"
				use:enhance={handleAction({ onSuccess: clearNewForm })}
				class="flex flex-col gap-3"
			>
				<h2 class="font-mono text-sm font-semibold">Nova regra</h2>
				<div class="flex flex-wrap items-end gap-2">
					<div class="flex flex-col gap-1">
						<Label for="ruleDescription">Descrição</Label>
						<Input
							id="ruleDescription"
							name="description"
							placeholder="ex.: Uber"
							bind:value={newDescription}
							class="w-72"
							required
						/>
					</div>
					<div class="flex flex-col gap-1">
						<Label for="ruleTags">Tags</Label>
						<TagInput
							id="ruleTags"
							name="tags"
							bind:value={newTags}
							options={data.tags}
							placeholder="Tags…"
							class="w-64"
						/>
					</div>
					<Button
						type="submit"
						variant="primary"
						disabled={!newDescription.trim() || newTags.length === 0}
					>
						Adicionar
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card>

	<!-- Rule list -->
	<Card>
		<Card.Content>
			<div class="flex flex-col gap-3">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="font-mono text-sm font-semibold">
						{data.rules.length}
						{data.rules.length === 1 ? 'regra' : 'regras'}
					</h2>
					<Input bind:value={searchQuery} placeholder="Buscar descrição ou tag…" class="w-64" />
				</div>

				<div class="border border-rule bg-paper-raised">
					<Table
						columns={[
							{ key: 'description', label: 'Descrição', sortable: true },
							{ key: 'tagNames', label: 'Tags' },
							{ key: 'createdAt', label: 'Criada em', sortable: true },
							{ key: 'actions', label: '' }
						]}
						{rows}
						widths={[4, 3, 2, 2]}
						rowKey="description"
						pageSize={25}
						pageSizeOptions={[10, 25, 50]}
					>
						{#snippet cell(row: Record<string, unknown>, key: string)}
							{#if key === 'description'}
								<span class="font-mono text-xs">{row.description}</span>
							{:else if key === 'tagNames'}
								{#if editingDescription === row.description}
									<!-- TagInput, not Select: a description maps to a SET of tags. -->
									<TagInput bind:value={editTags} options={data.tags} class="w-56" />
								{:else}
									<div class="flex flex-wrap gap-1">
										{#each row.tagNames as string[] as tagName (tagName)}
											<Badge variant="secondary">{tagName}</Badge>
										{/each}
									</div>
								{/if}
							{:else if key === 'createdAt'}
								<span class="text-xs text-ink-soft">{formatDate(Number(row.createdAt))}</span>
							{:else if key === 'actions'}
								<div class="flex items-center justify-end gap-2">
									{#if editingDescription === row.description}
										<form
											method="POST"
											action="?/update"
											use:enhance={handleAction({ onSuccess: cancelEdit })}
										>
											<input type="hidden" name="description" value={row.description} />
											<input type="hidden" name="tags" value={editTags.join(',')} />
											<Button type="submit" size="sm" variant="primary" disabled={!editTags.length}>
												Salvar
											</Button>
										</form>
										<Button type="button" size="sm" variant="ghost" onclick={cancelEdit}>
											Cancelar
										</Button>
									{:else}
										<Button
											size="sm"
											variant="outline"
											onclick={() => startEdit(String(row.description), row.tagNames as string[])}
										>
											Editar
										</Button>
										<form method="POST" action="?/remove" use:enhance={handleAction()}>
											<input type="hidden" name="description" value={row.description} />
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
									? 'Nenhuma regra ainda. Crie uma acima ou no detalhe de uma transação (card de Tags).'
									: 'Nenhuma regra encontrada para a busca.'}
							</p>
						{/snippet}
					</Table>
				</div>
			</div>
		</Card.Content>
	</Card>
</div>
