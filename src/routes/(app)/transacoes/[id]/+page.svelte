<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CategoryBadge from '$lib/CategoryBadge.svelte';
	import { Badge, Button, Card, Select } from '@tabeladev/tabelawebui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

	// Estado dos forms — separados por form pra não vazar sucesso/erro entre
	// cards (o `form` global é compartilhado entre as actions da página).
	let categorizeError = $state('');
	let categorizeDone = $state(false);
	let recurringFrequency = $state('monthly');
	let recurringDone = $state(false);
	let recurringError = $state('');

	// Categoria atual da transação — controla se o card de categorizar está
	// travado (já categorizada) ou ativo (escolher/limpar).
	const hasCategory = $derived(!!data.transaction.category);
	let selectedCategory = $state('');

	$effect(() => {
		// Pre-sincroniza o select com a categoria atual; também limpa os
		// estados de feedback quando a página recarrega (invalidateAll).
		selectedCategory = data.transaction.category ?? '';
		categorizeDone = false;
		categorizeError = '';
		recurringDone = false;
		recurringError = '';
	});

	const categoryOptions = $derived(data.categories.map((c) => ({ value: c.name, label: c.name })));
	const isExpense = $derived(data.transaction.displayAmount < 0);

	const categoryColor = (name: string | null) => {
		if (!name) return 'ctp-overlay1';
		return data.categories.find((c) => c.name === name)?.color ?? 'ctp-overlay1';
	};

	// Badge colorido via CSS variable (classes Tailwind dinâmicas não são
	// compiladas pelo JIT). `color` vem como "ctp-peach" e mapeia pra
	// --catppuccin-peach (variável global definida em layout.css).
	const categoryBadgeStyle = (name: string | null) => {
		const color = categoryColor(name).replace('ctp-', '');
		return `background-color: color-mix(in oklab, var(--catppuccin-${color}) 10%, transparent); color: var(--catppuccin-${color});`;
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
		<a href={resolve('/transacoes')} class="font-mono text-sm text-ink-soft hover:text-ink"
			>← Transações</a
		>
		<h1 class="font-mono text-2xl font-bold">{data.transaction.description}</h1>
	</header>

	<Card>
		<div class="flex flex-col gap-4">
			<div class="flex items-center justify-between">
				<span class="font-mono text-sm text-ink-soft">Valor</span>
				<span class="font-mono text-xl font-bold {isExpense ? 'text-ctp-red' : 'text-ctp-green'}">
					{currency.format(data.transaction.displayAmount)}
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
	</Card>

	<!-- Categorizar -->
	<Card>
		<h2 class="font-mono text-sm font-semibold">Categorizar</h2>
		<p class="mt-1 font-mono text-xs text-ink-soft">
			Ao categorizar, o app cria uma regra automática: transações futuras com a mesma descrição já
			entram categorizadas.
		</p>

		{#if hasCategory}
			<!-- Já categorizada: mostra travado, com opção de remover pra
			     re-categorizar. -->
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
						return async ({ result }) => {
							await applyAction(result);
							if (result.type === 'success') await invalidateAll();
						};
					}}
				>
					<Button type="submit" variant="ghost" size="sm" class="text-destructive">Remover</Button>
				</form>
			</div>
		{:else}
			<!-- Sem categoria: select ativo pra escolher. -->
			<form
				method="POST"
				action="?/categorize"
				use:enhance={() => {
					return async ({ result }) => {
						await applyAction(result);
						if (result.type === 'failure') {
							categorizeError = String(result.data?.error ?? 'Não foi possível salvar.');
							return;
						}
						// Sucesso: recarrega pra o badge/regra refletirem.
						categorizeDone = true;
						await invalidateAll();
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
					<p class="text-sm text-destructive">{categorizeError}</p>
				{/if}
				{#if categorizeDone}
					<p class="text-sm text-ctp-green">Categoria salva e regra criada.</p>
				{/if}
				<Button type="submit" variant="primary" disabled={!selectedCategory.trim()}>
					Salvar categoria
				</Button>
			</form>
		{/if}
	</Card>

	<!-- Criar recorrência a partir da transação -->
	<Card>
		<h2 class="font-mono text-sm font-semibold">Criar recorrência</h2>
		<p class="mt-1 font-mono text-xs text-ink-soft">
			Cria um gasto recorrente com a mesma descrição e valor desta transação — útil pra assinaturas
			e despesas fixas que se repetem.
		</p>
		<form
			method="POST"
			action="?/recurring"
			use:enhance={() => {
				return async ({ result }) => {
					await applyAction(result);
					if (result.type === 'failure') {
						recurringError = String(result.data?.error ?? 'Não foi possível criar a recorrência.');
						return;
					}
					await invalidateAll();
					recurringDone = true;
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
				<p class="text-sm text-destructive">{recurringError}</p>
			{/if}
			{#if recurringDone}
				<p class="text-sm text-ctp-green">Recorrência criada.</p>
			{/if}
			<Button type="submit" variant="outline">Adicionar recorrência</Button>
		</form>
	</Card>
</div>
