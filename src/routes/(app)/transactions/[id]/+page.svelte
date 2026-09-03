<script lang="ts">
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import { AccountType } from '$lib/enums/account-type';
	import { Frequency } from '$lib/enums/frequency';
	import { getCategoryColor } from '$lib/utils/categories';
	import { formatCurrency, formatDateLong } from '$lib/utils/format';
	import { handleAction } from '$lib/utils/forms';

	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Badge, Button, Card, Page, Select, TagInput, Toggle } from '@tabelhadev/tabelhawebui';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let recurringFrequency = $state(Frequency.Monthly);
	// One-shot read of the loaded tags (the TagInput owns it after that); the
	// function wrapper avoids the `state_referenced_locally` warning.
	const initialTags = () => data.tags;
	let tags = $state<string[]>(initialTags());
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

	const categoryColor = (name: string | null) => getCategoryColor(data.categories, name);

	const accountLabel = $derived(
		data.account?.type === AccountType.CreditCard
			? 'Cartão de crédito'
			: data.account?.type === AccountType.Investment
				? 'Investimento'
				: 'Conta corrente'
	);

	const sourceLabel: Record<string, string> = {
		ai: 'IA',
		rule: 'Regra automática',
		user: 'Manual',
		pdf_upload: 'Upload de PDF'
	};
</script>

<svelte:head>
	<title>Transação: TabelaFin</title>
</svelte:head>

<Page.Shell>
	<header>
		<a href={resolve('/transactions')} class="font-mono text-sm text-ink-soft hover:text-ink"
			>← Transações</a
		>
	</header>
	<Page.Header title={data.transaction.description} />

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
					<span class="font-mono text-sm">{formatDateLong(data.transaction.date)}</span>
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
		<Card.Header>
			<Card.Title>Categorizar</Card.Title>
			<Card.Description>
				Ao categorizar, o app cria uma regra automática: transações futuras com a mesma descrição já
				entram categorizadas.
			</Card.Description>
		</Card.Header>
		<Card.Content>
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
					<form method="POST" action="?/removeCategory" use:enhance={handleAction()}>
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
					use:enhance={handleAction()}
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
					<Button type="submit" variant="primary" disabled={!selectedCategory.trim()}>
						Salvar categoria
					</Button>
				</form>
			{/if}
		</Card.Content>
	</Card>

	<!-- Tags -->
	<Card>
		<Card.Header>
			<Card.Title>Tags</Card.Title>
			<Card.Description>
				Agrupam gastos pontuais sem criar categoria ("Viagem SP", "PC novo"): além da categoria, não
				no lugar dela.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				action="?/tags"
				use:enhance={handleAction()}
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
				<div class="flex gap-2">
					<Button type="submit" variant="outline">Salvar tags</Button>
				</div>
			</form>
		</Card.Content>
	</Card>

	<!-- Recurrence from transaction: mirrors the categorise card —
	     form while it does not exist, locked state after creation. -->
	<Card>
		<Card.Header>
			<Card.Title>Recorrência</Card.Title>
			<Card.Description>
				{#if hasRecurrence}
					Esta descrição já é acompanhada como gasto recorrente. A recorrência vale pra descrição
					inteira, não só pra esta transação: removê-la aqui remove pra todas.
				{:else}
					Cria um gasto recorrente com a mesma descrição e valor desta transação: útil pra
					assinaturas e despesas fixas que se repetem.
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if hasRecurrence && data.recurrence}
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex flex-wrap items-center gap-2">
						<Badge variant="secondary"
							>[{frequencyLabel[data.recurrence.frequency] ?? data.recurrence.frequency}]</Badge
						>
						<span class="font-mono text-sm">{formatCurrency(data.recurrence.amount)}</span>
						<a href={resolve('/recurring')} class="font-mono text-xs text-accent hover:underline">
							ver recorrências
						</a>
					</div>
					<form method="POST" action="?/removeRecurrence" use:enhance={handleAction()}>
						<Button type="submit" variant="ghost" size="sm" class="text-danger">
							Remover recorrência
						</Button>
					</form>
				</div>
			{:else}
				<form
					method="POST"
					action="?/recurring"
					use:enhance={handleAction()}
					class="flex flex-col gap-3"
				>
					<Select
						name="frequency"
						options={[
							{ value: Frequency.Weekly, label: 'Semanal' },
							{ value: Frequency.Monthly, label: 'Mensal' },
							{ value: Frequency.Quarterly, label: 'Trimestral' },
							{ value: Frequency.Yearly, label: 'Anual' }
						]}
						bind:value={recurringFrequency}
					/>
					<Button type="submit" variant="outline">Adicionar recorrência</Button>
				</form>
			{/if}
		</Card.Content>
	</Card>
</Page.Shell>
