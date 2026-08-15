<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import { Badge, Button, Card, Select, TagInput, Toggle } from '@tabeladev/tabelawebui';
	import { formatCurrency } from '$lib/lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Form state — kept per form so success/error does not leak between cards (the
	// global `form` is shared by every action on the page).
	let categorizeError = $state('');
	let categorizeDone = $state(false);
	let recurringFrequency = $state('monthly');
	let recurringError = $state('');
	// One-shot read of the loaded tags (the TagInput owns it after that); the
	// function wrapper avoids the `state_referenced_locally` warning.
	const initialTags = () => data.tags;
	let tags = $state<string[]>(initialTags());
	let tagsError = $state('');
	let tagsDone = $state(false);
	// Whether an automatic rule already exists for this description (so the
	// toggle starts checked on re-open).
	const initialTagRule = () => data.tagRuleNames.length > 0;
	let createTagRule = $state(initialTagRule());

	// The transaction's current category — decides whether the categorise card is
	// locked (already categorised) or active (choose/clear).
	const hasCategory = $derived(!!data.transaction.category);

	// Same idea for the recurrence card. The lookup is by description, so this
	// reads true on every transaction sharing it — the recurrence describes the
	// charge, not one occurrence of it.
	const hasRecurrence = $derived(!!data.recurrence);

	const frequencyLabel: Record<string, string> = {
		weekly: 'Semanal',
		monthly: 'Mensal',
		quarterly: 'Trimestral',
		yearly: 'Anual'
	};

	// Follows the loaded category but stays writable so the Select can bind to
	// it. This was a $state plus an $effect that also cleared all five feedback
	// flags on any change to `data` — so one card's invalidateAll wiped the
	// neighbouring card's message, the same coupling the per-form state was
	// meant to remove. Each form resets its own now.
	let selectedCategory = $derived(data.transaction.category ?? '');

	const categoryOptions = $derived(data.categories.map((c) => ({ value: c.name, label: c.name })));
	const isExpense = $derived(data.transaction.displayAmount < 0);

	const categoryColor = (name: string | null) => {
		if (!name) return 'ctp-overlay1';
		return data.categories.find((c) => c.name === name)?.color ?? 'ctp-overlay1';
	};

	const accountLabel = $derived(
		data.account?.type === 'credit_card'
			? 'Cartão de crédito'
			: data.account?.type === 'investment'
				? 'Investimento'
				: 'Conta corrente'
	);

	const formatDate = (ts: Date | string) => {
		const d = typeof ts === 'string' ? new Date(ts) : ts;
		return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
	};

	const sourceLabel: Record<string, string> = {
		ai: 'IA',
		rule: 'Regra automática',
		user: 'Manual',
		pdf_upload: 'Upload de PDF'
	};
</script>

<svelte:head>
	<title>Transação — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header>
		<a href={resolve('/transactions')} class="font-mono text-sm text-ink-soft hover:text-ink"
			>← Transações</a
		>
		<h1 class="font-mono text-2xl font-bold">{data.transaction.description}</h1>
	</header>

	<Card>
		<Card.Content>
			<div class="flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<span class="font-mono text-sm text-ink-soft">Valor</span>
					<span class="font-mono text-xl font-bold {isExpense ? 'text-ctp-red' : 'text-ctp-green'}">
						{formatCurrency(data.transaction.displayAmount)}
					</span>
				</div>

				<div class="flex items-center justify-between border-t border-rule pt-3">
					<span class="font-mono text-sm text-ink-soft">Data</span>
					<span class="font-mono text-sm">{formatDate(data.transaction.date)}</span>
				</div>

				<div class="flex items-center justify-between border-t border-rule pt-3">
					<span class="font-mono text-sm text-ink-soft">Conta</span>
					<span class="font-mono text-sm">
						{data.account
							? `${data.account.name} · ${data.account.institution} (${accountLabel})`
							: '—'}
					</span>
				</div>

				{#if data.transaction.currency && data.transaction.currency !== 'BRL'}
					<div class="flex items-center justify-between border-t border-rule pt-3">
						<span class="font-mono text-sm text-ink-soft">Moeda original</span>
						<span class="font-mono text-sm">{data.transaction.currency}</span>
					</div>
				{/if}

				<div class="flex items-center justify-between border-t border-rule pt-3">
					<span class="font-mono text-sm text-ink-soft">Categoria</span>
					{#if data.transaction.category}
						<CategoryBadge
							category={data.transaction.category}
							color={categoryColor(data.transaction.category)}
						/>
					{:else}
						<span class="font-mono text-sm text-ink-faint">[sem categoria]</span>
					{/if}
				</div>

				{#if data.transaction.categorySource}
					<div class="flex items-center justify-between border-t border-rule pt-3">
						<span class="font-mono text-sm text-ink-soft">Categorizada por</span>
						<span class="font-mono text-sm text-ink-soft">
							{sourceLabel[data.transaction.categorySource] ?? data.transaction.categorySource}
						</span>
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card>

	<!-- Categorise -->
	<Card>
		<Card.Content>
			<h2 class="font-mono text-sm font-semibold">Categorizar</h2>
			<p class="mt-1 font-mono text-xs text-ink-soft">
				Ao categorizar, o app cria uma regra automática: transações futuras com a mesma descrição já
				entram categorizadas.
			</p>

			<!-- Outside the branch on purpose: a successful categorise flips
			     hasCategory, so a confirmation rendered inside the {:else} arm would
			     be replaced by the badge before it could ever be seen. -->
			{#if categorizeDone}
				<p class="mt-3 text-sm text-ctp-green">Categoria salva e regra criada.</p>
			{/if}

			{#if hasCategory}
				<!-- Already categorised: shows locked, with an option to remove to
				     re-categorise. -->
				<div class="mt-3 flex items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<CategoryBadge
							category={data.transaction.category}
							color={categoryColor(data.transaction.category)}
						/>
						{#if data.transaction.categorySource}
							<span class="font-mono text-xs text-ink-faint">
								({sourceLabel[data.transaction.categorySource] ?? data.transaction.categorySource})
							</span>
						{/if}
					</div>
					<form
						method="POST"
						action="?/removeCategory"
						use:enhance={() => {
							categorizeDone = false;
							categorizeError = '';
							return async ({ result }) => {
								await applyAction(result);
								if (result.type === 'success') await invalidateAll();
							};
						}}
					>
						<Button type="submit" variant="ghost" size="sm" class="text-danger">
							Remover categoria e regra
						</Button>
					</form>
				</div>
			{:else}
				<!-- No category: active select to choose. -->
				<form
					method="POST"
					action="?/categorize"
					use:enhance={() => {
						categorizeError = '';
						categorizeDone = false;
						return async ({ result }) => {
							await applyAction(result);
							if (result.type === 'failure') {
								categorizeError = String(result.data?.error ?? 'Não foi possível salvar.');
								return;
							}
							// Reload first so the badge reflects the save, then raise the
							// confirmation — the other order had it cleared by the reload.
							await invalidateAll();
							categorizeDone = true;
						};
					}}
					class="mt-3 flex flex-col gap-3"
				>
					<Select
						name="category"
						options={categoryOptions}
						placeholder="Escolher categoria"
						bind:value={selectedCategory}
						filter
						filterPlaceholder="Buscar categoria…"
					/>
					{#if categorizeError}
						<p class="text-sm text-danger">{categorizeError}</p>
					{/if}
					<Button type="submit" variant="primary" disabled={!selectedCategory.trim()}>
						Salvar categoria
					</Button>
				</form>
			{/if}
		</Card.Content>
	</Card>

	<!-- Tags -->
	<Card>
		<Card.Content>
			<h2 class="font-mono text-sm font-semibold">Tags</h2>
			<p class="mt-1 font-mono text-xs text-ink-soft">
				Agrupam gastos pontuais sem criar categoria ("Viagem SP", "PC novo") — além da categoria,
				não no lugar dela.
			</p>

			<form
				method="POST"
				action="?/tags"
				use:enhance={() => {
					tagsError = '';
					tagsDone = false;
					return async ({ result }) => {
						await applyAction(result);
						if (result.type === 'failure') {
							tagsError = String(result.data?.error ?? 'Não foi possível salvar.');
							return;
						}
						await invalidateAll();
						tagsDone = true;
					};
				}}
				class="mt-3 flex flex-col gap-3"
			>
				<TagInput
					name="tags"
					bind:value={tags}
					options={data.userTags}
					placeholder="Adicione uma tag…"
				/>
				<div class="flex flex-col gap-2">
					<Toggle
						bind:checked={createTagRule}
						label="Sempre que esta descrição aparecer, aplicar estas tags"
					/>
					<input type="hidden" name="createRule" value={createTagRule ? 'on' : ''} />
					<p class="font-mono text-xs text-ink-faint">
						Vale pra novas transações com a mesma descrição (e volta pra aplicar nas antigas).
					</p>
				</div>
				{#if tagsError}
					<p class="text-sm text-danger">{tagsError}</p>
				{/if}
				{#if tagsDone}
					<p class="text-sm text-ctp-green">Tags salvas.</p>
				{/if}
				<div class="flex gap-2">
					<Button type="submit" variant="outline">Salvar tags</Button>
				</div>
			</form>
		</Card.Content>
	</Card>

	<!-- Recurrence from transaction: mirrors the categorise card —
	     form while it does not exist, locked state after creation. -->
	<Card>
		<Card.Content>
			<h2 class="font-mono text-sm font-semibold">Recorrência</h2>
			<p class="mt-1 font-mono text-xs text-ink-soft">
				{#if hasRecurrence}
					Esta descrição já é acompanhada como gasto recorrente. A recorrência vale pra descrição
					inteira, não só pra esta transação — removê-la aqui remove pra todas.
				{:else}
					Cria um gasto recorrente com a mesma descrição e valor desta transação — útil pra
					assinaturas e despesas fixas que se repetem.
				{/if}
			</p>

			{#if hasRecurrence && data.recurrence}
				<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
					<div class="flex flex-wrap items-center gap-2">
						<Badge>[{frequencyLabel[data.recurrence.frequency] ?? data.recurrence.frequency}]</Badge
						>
						<span class="font-mono text-sm">{formatCurrency(data.recurrence.amount)}</span>
						<a href={resolve('/recurring')} class="font-mono text-xs text-accent hover:underline">
							ver recorrências
						</a>
					</div>
					<form
						method="POST"
						action="?/removeRecurrence"
						use:enhance={() => {
							recurringError = '';
							return async ({ result }) => {
								await applyAction(result);
								if (result.type === 'failure') {
									recurringError = String(
										result.data?.error ?? 'Não foi possível remover a recorrência.'
									);
									return;
								}
								await invalidateAll();
							};
						}}
					>
						<Button type="submit" variant="ghost" size="sm" class="text-danger">
							Remover recorrência
						</Button>
					</form>
				</div>
				{#if recurringError}
					<p class="mt-2 text-sm text-danger">{recurringError}</p>
				{/if}
			{:else}
				<form
					method="POST"
					action="?/recurring"
					use:enhance={() => {
						recurringError = '';
						return async ({ result }) => {
							await applyAction(result);
							if (result.type === 'failure') {
								recurringError = String(
									result.data?.error ?? 'Não foi possível criar a recorrência.'
								);
								return;
							}
							// No success message here: the reload flips the card to the
							// "already created" state, which replaces this whole branch —
							// a confirmation rendered inside it could never be read.
							await invalidateAll();
						};
					}}
					class="mt-3 flex flex-col gap-3"
				>
					<Select
						name="frequency"
						options={[
							{ value: 'weekly', label: 'Semanal' },
							{ value: 'monthly', label: 'Mensal' },
							{ value: 'quarterly', label: 'Trimestral' },
							{ value: 'yearly', label: 'Anual' }
						]}
						bind:value={recurringFrequency}
					/>
					{#if recurringError}
						<p class="text-sm text-danger">{recurringError}</p>
					{/if}
					<Button type="submit" variant="outline">Adicionar recorrência</Button>
				</form>
			{/if}
		</Card.Content>
	</Card>
</div>
