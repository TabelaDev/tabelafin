<script lang="ts">
	import CategoryBadge from '$lib/CategoryBadge.svelte';
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Table, Button, Select, DatePicker, Input, Dialog } from '@tabeladev/tabelawebui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

	// Estado local iniciado dos filtros da URL — leitura one-shot proposital (não
	// re-sincroniza se `data` mudar); o wrapper em função evita o aviso
	// `state_referenced_locally` do compilador.
	const initialFilters = () => ({
		search: data.filters.search ?? '',
		category: data.filters.category ?? '',
		month: data.filters.month ?? '',
		tipo: data.filters.tipo ?? ''
	});
	let searchQuery = $state(initialFilters().search);
	let category = $state(initialFilters().category);
	let month = $state(initialFilters().month);
	let tipo = $state(initialFilters().tipo);

	// Busca client-side — não recarrega a página a cada tecla (preserva o foco).
	let visible = $derived(
		searchQuery
			? data.transactions.filter((t) =>
					t.description.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: data.transactions
	);

	// Sincroniza o estado local com os filtros da URL quando ela muda por
	// navegação externa (botão "Limpar", voltar do browser, link). Lido com
	// `untrack` pra só reagir a mudanças de URL, não aos próprios estados.
	$effect(() => {
		const s = page.url.searchParams.get('q') ?? '';
		const c = page.url.searchParams.get('categoria') ?? '';
		const m = page.url.searchParams.get('mes') ?? '';
		const t = page.url.searchParams.get('tipo') ?? '';
		untrack(() => {
			if (s !== searchQuery) searchQuery = s;
			if (c !== category) category = c;
			if (m !== month) month = m;
			if (t !== tipo) tipo = t;
		});
	});

	// Categoria/mês/tipo: navegam full-page (filtros na URL), mas só quando o
	// valor realmente mudou em relação ao que veio do servidor.
	$effect(() => {
		if (category !== (data.filters.category ?? '')) applyFilter('categoria', category);
	});
	$effect(() => {
		if (month !== (data.filters.month ?? '')) applyFilter('mes', month);
	});
	$effect(() => {
		if (tipo !== (data.filters.tipo ?? '')) applyFilter('tipo', tipo);
	});

	const categoryColor = (cat: string | null) => {
		if (!cat) return 'ctp-overlay1';
		return data.categories.find((c) => c.name === cat)?.color ?? 'ctp-overlay1';
	};

	function formatDate(ts: Date | string): string {
		const d = typeof ts === 'string' ? new Date(ts) : ts;
		return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function applyFilter(key: string, value: string) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		// Navegação full-page (não client-side) preserva os filtros na URL.
		window.location.href = `${url.pathname}${url.search}`;
	}

	// ── Categorização em massa ────────────────────────────────────────────────
	// Linhas selecionadas na tabela (a Table do twui fornece `selection` +
	// `selected`). As linhas mapeadas carregam `id` — é ele que mandamos pro
	// servidor.
	let selected = $state<Record<string, unknown>[]>([]);
	let bulkCategory = $state('');
	let bulkSubmitting = $state(false);
	let bulkError = $state('');

	const selectedIds = $derived(selected.map((r) => String(r.id)).filter(Boolean));

	// Every currently visible row (after the server's search/filters) — "select
	// all" ticks exactly these, in the shape the Table expects (same row keys:
	// id, date, description, category, amount).
	//
	// `date` goes in as a timestamp and is formatted in the `cell` snippet. The
	// Table only compares numerically when both sides are numbers; with the date
	// pre-formatted it fell through to localeCompare and ordered "01 de ago." <
	// "01 de dez." < "01 de jan." — alphabetical by month name, not chronological.
	//
	// Knock-on effect: the Table's global filter matches on String(row[key]), so
	// turning `filterable` on here would break searching by date. This page's
	// search is the separate <Input>, which filters `visible` before the rows.
	const visibleRows = $derived(
		visible.map((tx) => ({
			id: tx.id,
			date: new Date(tx.date).getTime(),
			description: tx.description,
			category: tx.category,
			amount: tx.displayAmount,
			// Not a column — carried along so the dialog knows which rows the
			// server will actually touch (it preserves manual categories).
			categorySource: tx.categorySource
		}))
	);

	const allVisibleSelected = $derived(
		visibleRows.length > 0 && visibleRows.every((r) => selected.some((s) => s.id === r.id))
	);

	function toggleSelectAll() {
		if (allVisibleSelected) {
			selected = selected.filter((s) => !visibleRows.some((r) => r.id === s.id));
		} else {
			// Marca todas as visíveis preservando as já selecionadas de outras
			// páginas/filtros.
			const existing = selected.filter((s) => !visibleRows.some((r) => r.id === s.id));
			selected = [...existing, ...visibleRows];
		}
	}

	function clearSelection() {
		selected = [];
		bulkCategory = '';
		bulkError = '';
	}

	// ── Automatic-rule confirmation ───────────────────────────────────────────
	// Descriptions that would get a rule if the user confirms. Only the rows the
	// server will actually recategorise count: a row already categorised by hand
	// keeps its category, so minting a rule from it would leave the rule
	// contradicting the very transaction it was read from.
	let showRuleDialog = $state(false);

	const pendingRuleDescriptions = $derived([
		...new Set(
			selected.filter((r) => r.categorySource !== 'user').map((r) => String(r.description ?? ''))
		)
	]);

	function openBulkCategorize() {
		if (selectedIds.length === 0 || !bulkCategory.trim()) return;
		bulkError = '';
		// With no description eligible for a rule there is no decision to make —
		// the dialog would be asking about an empty list.
		if (pendingRuleDescriptions.length === 0) {
			submitBulkCategorize(false);
			return;
		}
		showRuleDialog = true;
	}

	async function submitBulkCategorize(createRules: boolean) {
		if (selectedIds.length === 0 || !bulkCategory.trim()) return;
		showRuleDialog = false;
		bulkSubmitting = true;
		bulkError = '';
		try {
			const body = new FormData();
			body.set('ids', selectedIds.join(','));
			body.set('category', bulkCategory.trim());
			if (createRules) body.set('create_rules', 'yes');
			const res = await fetch('/transacoes?/bulkCategorize', {
				method: 'POST',
				body
			});
			const result = (await res.json()) as { data?: { error?: string } };
			// SvelteKit responde fetch de form action como
			// { type, status, data } — o payload fica em `result.data`.
			if (!res.ok || result.data?.error) {
				bulkError = result.data?.error ?? 'Não foi possível categorizar.';
				return;
			}
			// Recarrega a página pra refletir as categorias novas.
			await invalidateAll();
			clearSelection();
		} finally {
			bulkSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Transações — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<header>
		<h1 class="font-mono text-2xl font-bold">Transações</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span>
			{visible.length} registros
			{#if tipo && visible.length > 0}
				· total
				<span class={tipo === 'receitas' ? 'text-ctp-green' : 'text-ctp-red'}>
					<!-- Sum first, then take the magnitude. Summing Math.abs of each
					     row made a refund add to the expense total instead of
					     reducing it. -->
					{currency.format(Math.abs(visible.reduce((sum, t) => sum + t.displayAmount, 0)))}
				</span>
			{/if}
			{#if data.future.length > 0}
				· <a href={resolve('/proximas')} class="text-accent hover:underline"
					>{data.future.length} lançamento{data.future.length === 1 ? '' : 's'} futuro{data.future
						.length === 1
						? ''
						: 's'}</a
				>
			{/if}
		</p>
	</header>

	<!-- Filtros -->
	<div class="flex flex-wrap items-center gap-2 lg:flex-nowrap">
		<Input
			bind:value={searchQuery}
			placeholder="Buscar descrição..."
			class="w-full min-w-40 sm:w-64"
		/>
		<Select
			class="w-56"
			options={[
				{ value: '', label: 'Todas as categorias' },
				...data.categories.map((cat) => ({ value: cat.name, label: cat.name }))
			]}
			bind:value={category}
			filter
			filterPlaceholder="Buscar categoria…"
		/>
		<Select
			class="w-44"
			options={[
				{ value: '', label: 'Todos os tipos' },
				{ value: 'receitas', label: 'Receitas' },
				{ value: 'despesas', label: 'Despesas' }
			]}
			bind:value={tipo}
		/>
		<DatePicker class="w-44" mode="month" placeholder="Todos os meses" bind:value={month} />
		<a href={resolve('/transacoes')} class="ml-auto">
			<Button variant="ghost">Limpar</Button>
		</a>
	</div>

	<!-- Categorização em massa — aparece quando há linhas selecionadas -->
	{#if selectedIds.length > 0}
		<div class="flex flex-wrap items-center gap-2 border border-accent bg-accent-soft p-3">
			<span class="font-mono text-sm font-semibold text-accent">
				{selectedIds.length} selecionad{selectedIds.length === 1 ? 'a' : 'as'}
			</span>
			<Button variant="outline" onclick={toggleSelectAll} disabled={visibleRows.length === 0}>
				{allVisibleSelected ? 'Desmarcar todas' : 'Selecionar todas'}
			</Button>
			<Select
				class="w-56"
				placeholder="Categoria…"
				options={[
					{ value: '', label: 'Escolher categoria…' },
					...data.categories.map((cat) => ({ value: cat.name, label: cat.name }))
				]}
				bind:value={bulkCategory}
				filter
				filterPlaceholder="Buscar categoria…"
			/>
			<Button
				variant="primary"
				disabled={!bulkCategory.trim() || bulkSubmitting}
				onclick={openBulkCategorize}
			>
				{bulkSubmitting ? 'Aplicando…' : 'Aplicar'}
			</Button>
			<Button variant="ghost" onclick={clearSelection}>Cancelar</Button>
			{#if bulkError}
				<span class="font-mono text-sm text-destructive">{bulkError}</span>
			{/if}
		</div>
	{/if}

	<!-- Tabela -->
	<div class="overflow-x-auto border border-rule bg-paper-raised">
		<Table
			columns={[
				{ key: 'date', label: 'Data', sortable: true },
				{ key: 'description', label: 'Descrição' },
				{ key: 'category', label: 'Categoria' },
				{ key: 'amount', label: 'Valor', sortable: true },
				{ key: 'action', label: '' }
			]}
			rows={visibleRows}
			widths={[1, 3, 1, 1, 0.5]}
			pageSize={10}
			pageSizeOptions={[10, 25, 50]}
			selection="multiple"
			rowKey="id"
			bind:selected
		>
			{#snippet cell(row: Record<string, unknown>, key: string)}
				{#if key === 'date'}
					<span class="text-xs text-ink-soft">{formatDate(new Date(Number(row.date)))}</span>
				{:else if key === 'category'}
					{#if row.category}
						<CategoryBadge
							category={String(row.category)}
							color={categoryColor(String(row.category))}
						/>
					{:else}
						<span class="text-xs text-ink-faint">[sem categoria]</span>
					{/if}
				{:else if key === 'amount'}
					<span class={Number(row.amount) >= 0 ? 'text-ctp-green' : 'text-ctp-red'}>
						{currency.format(Number(row.amount))}
					</span>
				{:else if key === 'action'}
					<!-- Ação explícita de abrir o detalhe — clicar na linha seleciona,
					     clicar no botão navega (sem conflito). -->
					<a
						href={resolve(`/transacoes/${row.id}`)}
						class="inline-flex items-center justify-center text-accent transition-colors hover:opacity-70"
						aria-label="Ver detalhes"
						onclick={(e) => e.stopPropagation()}
					>
						→
					</a>
				{:else}
					<span>{row.description}</span>
				{/if}
			{/snippet}
			{#snippet empty()}
				<p class="py-12 text-center font-mono text-sm text-ink-soft">
					Nenhuma transação encontrada.
				</p>
			{/snippet}
		</Table>
	</div>
</div>

<!-- Closing by X/Esc/overlay leaves `showRuleDialog` false and submits nothing,
     so dismissing the dialog cancels the whole action rather than falling
     through to the categorise-only path. -->
<Dialog bind:open={showRuleDialog} title="Criar regra automática?">
	<div class="flex flex-col gap-3">
		<p class="font-mono text-sm text-ink-soft">
			Além de categorizar as {selectedIds.length} transações selecionadas, o app pode criar uma regra
			por descrição — assim transações futuras com a mesma descrição já entram como
			<span class="text-ink">{bulkCategory}</span>.
		</p>
		<div class="border border-rule bg-paper p-3">
			<p class="font-mono text-xs text-ink-soft">
				{pendingRuleDescriptions.length}
				{pendingRuleDescriptions.length === 1 ? 'descrição' : 'descrições'}:
			</p>
			<ul class="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
				{#each pendingRuleDescriptions as description (description)}
					<li class="truncate font-mono text-xs">{description}</li>
				{/each}
			</ul>
		</div>
	</div>
	{#snippet footer()}
		<Button variant="ghost" disabled={bulkSubmitting} onclick={() => submitBulkCategorize(false)}>
			Apenas categorizar
		</Button>
		<Button variant="primary" disabled={bulkSubmitting} onclick={() => submitBulkCategorize(true)}>
			Categorizar e criar regra
		</Button>
	{/snippet}
</Dialog>
