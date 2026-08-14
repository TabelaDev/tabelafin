<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ActionResult } from '@sveltejs/kit';
	import { Button, Card, Dialog, Input } from '@tabeladev/tabelawebui';
	import { formatCurrency } from '$lib/lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newName = $state('');

	// One edit row at a time, like the categories page.
	let editingTag = $state<{ tagId: string; name: string } | null>(null);
	let editName = $state('');

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

	const handleRemove = () => {
		return async ({ result }: { result: ActionResult }) => {
			await applyAction(result);
			if (result.type === 'success') await invalidateAll();
		};
	};

	const handleForm = (onSuccess: () => void) => {
		return () => {
			return async ({ result }: { result: ActionResult }) => {
				await applyAction(result);
				if (result.type === 'success') {
					onSuccess();
					await invalidateAll();
				}
			};
		};
	};

	const total = data.tags.reduce((sum, t) => sum + t.expense + t.income, 0);
	const totalExpense = data.tags.reduce((sum, t) => sum + t.expense, 0);
	const totalIncome = data.tags.reduce((sum, t) => sum + t.income, 0);
</script>

<svelte:head>
	<title>Tags — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header>
		<h1 class="font-mono text-2xl font-bold">Tags</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span> Agrupam gastos pontuais sem criar categoria ("Viagem SP",
			"PC novo"). A tag é além da categoria, não no lugar dela.
		</p>
	</header>

	<!-- Summary -->
	<Card>
		<Card.Content>
			<div class="flex flex-wrap gap-6">
				<div class="flex flex-col gap-1">
					<span class="font-mono text-xs text-ink-faint">Total marcado</span>
					<span class="font-mono text-sm">{formatCurrency(total)}</span>
				</div>
				<div class="flex flex-col gap-1">
					<span class="font-mono text-xs text-ink-faint">Gastos</span>
					<span class="font-mono text-sm text-ctp-red">{formatCurrency(totalExpense)}</span>
				</div>
				<div class="flex flex-col gap-1">
					<span class="font-mono text-xs text-ink-faint">Receitas</span>
					<span class="font-mono text-sm text-ctp-green">{formatCurrency(totalIncome)}</span>
				</div>
			</div>
		</Card.Content>
	</Card>

	<!-- New tag -->
	<Card>
		<Card.Content>
			<form
				method="POST"
				action="?/add"
				use:enhance={handleForm(() => (newName = ''))}
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

				{#if data.tags.length === 0}
					<p class="font-mono text-sm text-ink-soft">
						Nenhuma tag ainda. Crie uma acima ou marque transações com tags no lançamento/edição.
					</p>
				{/if}

				{#each data.tags as tag (tag.tagId)}
					<div
						class="flex items-center justify-between gap-3 border-b border-rule py-2 last:border-b-0"
					>
						{#if editingTag?.tagId === tag.tagId}
							<form
								method="POST"
								action="?/rename"
								use:enhance={handleForm(cancelEdit)}
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
								<form method="POST" action="?/remove" use:enhance={handleRemove}>
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
		Excluir a tag <span class="text-ink">{pendingDelete?.name}</span>? Nenhuma transação é apagada —
		só o agrupamento some.
	</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (showDeleteDialog = false)}>Cancelar</Button>
		<Button variant="danger" onclick={confirmDelete}>Excluir</Button>
	{/snippet}
</Dialog>
