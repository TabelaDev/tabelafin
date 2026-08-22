<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Card, Dialog, Input } from '@tabeladev/tabelawebui';
	import { formatCurrency } from '$lib/utils/format';
	import { handleAction } from '$lib/utils/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newName = $state('');

	// One edit row at a time, like the categories page next door.
	let editingTag = $state<{ tagId: string; name: string } | null>(null);
	let editName = $state('');

	// Client-side search, like categories/manage — no page reload per keystroke.
	let searchQuery = $state('');
	const filteredTags = $derived(
		searchQuery.trim()
			? data.tags.filter((t) => t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
			: data.tags
	);

	// Delete confirmation — mirrors categories/manage.
	let showDeleteDialog = $state(false);
	let pendingDelete = $state<{ tagId: string; name: string; form: HTMLFormElement } | null>(null);

	function startEdit(tag: { tagId: string; name: string }) {
		editingTag = tag;
		editName = tag.name;
	}

	function cancelEdit() {
		editingTag = null;
	}

	function openDelete(tag: { tagId: string; name: string }, form: HTMLFormElement) {
		pendingDelete = { ...tag, form };
		showDeleteDialog = true;
	}

	function confirmDelete() {
		pendingDelete?.form.requestSubmit();
		pendingDelete = null;
		showDeleteDialog = false;
	}

	$effect(() => {
		if (!showDeleteDialog) pendingDelete = null;
	});
</script>

<svelte:head>
	<title>Gerenciar tags: TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-wrap items-start justify-between gap-2">
		<div>
			<a href={resolve('/tags')} class="font-mono text-sm text-ink-soft hover:text-ink">← Tags</a>
			<h1 class="font-mono text-2xl font-bold">Gerenciar tags</h1>
			<p class="font-mono text-sm text-ink-soft">
				<span class="text-ink-faint">//</span> Crie, renomeie ou exclua suas tags. Excluir uma tag só
				desfaz o agrupamento: nenhuma transação é apagada.
			</p>
		</div>
		<a href={resolve('/tags/rules')} class="font-mono text-xs text-accent hover:underline"
			>regras automáticas</a
		>
	</header>

	<!-- New tag -->
	<Card>
		<Card.Content>
			<form
				method="POST"
				action="?/add"
				use:enhance={handleAction({ onSuccess: () => (newName = '') })}
				class="flex flex-wrap items-end gap-2"
			>
				<h2 class="w-full font-mono text-sm font-semibold">Nova tag</h2>
				<Input
					name="name"
					placeholder="Ex.: Viagem SP, PC novo…"
					bind:value={newName}
					class="w-56"
					required
				/>
				<Button type="submit" variant="primary" disabled={!newName.trim()}>Adicionar</Button>
			</form>
		</Card.Content>
	</Card>

	<!-- Tag list -->
	<Card>
		<Card.Content>
			<div class="flex flex-col gap-2">
				<h2 class="font-mono text-sm font-semibold">Suas tags</h2>
				<Input bind:value={searchQuery} placeholder="Buscar tag…" />

				{#if data.tags.length === 0}
					<p class="py-6 font-mono text-sm text-ink-soft">
						Nenhuma tag ainda. Crie uma acima ou marque transações com tags no lançamento/edição.
					</p>
				{:else if filteredTags.length === 0}
					<p class="py-6 font-mono text-sm text-ink-soft">Nenhuma tag corresponde à busca.</p>
				{/if}

				{#each filteredTags as tag (tag.tagId)}
					<div
						class="flex items-center justify-between gap-3 border-b border-rule py-2 last:border-b-0"
					>
						{#if editingTag?.tagId === tag.tagId}
							<form
								method="POST"
								action="?/rename"
								use:enhance={handleAction({ onSuccess: cancelEdit })}
								class="flex flex-wrap items-center gap-2"
							>
								<input type="hidden" name="tagId" value={tag.tagId} />
								<Input name="newName" bind:value={editName} class="w-44" required />
								<Button type="submit" size="sm" variant="primary">Salvar</Button>
								<Button type="button" size="sm" variant="ghost" onclick={cancelEdit}
									>Cancelar</Button
								>
							</form>
						{:else}
							<div class="flex min-w-0 flex-col gap-1">
								<a
									href={resolve(`/transactions?tag=${encodeURIComponent(tag.name)}`)}
									class="truncate font-mono text-sm text-ink hover:text-accent hover:underline"
									>{tag.name}</a
								>
								<span class="font-mono text-xs text-ink-faint">
									{tag.count} transação{tag.count === 1 ? '' : 'ões'} · gastos
									<span class="text-ctp-red">{formatCurrency(tag.expense)}</span>
									· receitas
									<span class="text-ctp-green">{formatCurrency(tag.income)}</span>
								</span>
							</div>
							<div class="flex items-center gap-2">
								<Button size="sm" variant="outline" onclick={() => startEdit(tag)}>Editar</Button>
								<form method="POST" action="?/remove" use:enhance={handleAction()}>
									<input type="hidden" name="tagId" value={tag.tagId} />
									<Button
										type="button"
										size="sm"
										variant="ghost"
										class="text-ctp-red hover:text-ctp-red"
										onclick={(e) =>
											openDelete(
												tag,
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
			</div>
		</Card.Content>
	</Card>
</div>

<Dialog bind:open={showDeleteDialog} title="Excluir tag?">
	<p class="text-justify font-mono text-sm text-ink-soft">
		Excluir a tag <span class="text-ink">{pendingDelete?.name}</span>? Nenhuma transação é apagada:
		só o agrupamento some, junto das regras automáticas que usavam essa tag.
	</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (showDeleteDialog = false)}>Cancelar</Button>
		<Button variant="danger" onclick={confirmDelete}>Excluir</Button>
	{/snippet}
</Dialog>
