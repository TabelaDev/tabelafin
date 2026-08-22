<script lang="ts">
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		Table,
		Button,
		Select,
		DatePicker,
		Input,
		Dialog,
		Toggle,
		TagInput,
		toast
	} from '@tabeladev/tabelawebui';
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Local state seeded from the URL filters — a deliberate one-shot read (it does
	// not re-sync when `data` changes); the function wrapper avoids the compiler's
	// `state_referenced_locally` warning.
	const initialFilters = () => ({
		search: data.filters.search ?? '',
		category: data.filters.category ?? '',
		month: data.filters.month ?? '',
		type: data.filters.type ?? '',
		tag: data.filters.tag ?? '',
		internal: data.filters.internal ?? ''
	});
	let searchQuery = $state(initialFilters().search);
	let category = $state(initialFilters().category);
	let month = $state(initialFilters().month);
	let type = $state(initialFilters().type);
	let tag = $state(initialFilters().tag);
	let showInternal = $state(initialFilters().internal === 'yes');

	// Client-side search — no page reload per keystroke, so focus is preserved.
	let visible = $derived(
		searchQuery
			? data.transactions.filter((t) =>
					t.description.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: data.transactions
	);

	// Brings the local state back in line with the URL filters when the URL changes
	// from outside (the "Limpar" button, the browser's back, a link). Read through
	// `untrack` so this reacts to URL changes only, not to its own state.
	$effect(() => {
		const s = page.url.searchParams.get('q') ?? '';
		const c = page.url.searchParams.get('category') ?? '';
		const m = page.url.searchParams.get('month') ?? '';
		const t = page.url.searchParams.get('type') ?? '';
		const g = page.url.searchParams.get('tag') ?? '';
		const i = (page.url.searchParams.get('internal') ?? '') === 'yes';
		untrack(() => {
			if (s !== searchQuery) searchQuery = s;
			if (c !== category) category = c;
			if (m !== month) month = m;
			if (t !== type) type = t;
			if (g !== tag) tag = g;
			if (i !== showInternal) showInternal = i;
		});
	});

	// Category/month/type navigate full-page (the filters live in the URL), but
	// only when the value actually differs from what the server sent.
	$effect(() => {
		if (category !== (data.filters.category ?? '')) applyFilter('category', category);
	});
	$effect(() => {
		if (month !== (data.filters.month ?? '')) applyFilter('month', month);
	});
	$effect(() => {
		if (type !== (data.filters.type ?? '')) applyFilter('type', type);
	});
	$effect(() => {
		if (tag !== (data.filters.tag ?? '')) applyFilter('tag', tag);
	});
	$effect(() => {
		const current = (data.filters.internal ?? '') === 'yes';
		if (showInternal !== current) applyFilter('internal', showInternal ? 'yes' : '');
	});

	const categoryColor = (cat: string | null) => {
		if (!cat) return 'ctp-overlay1';
		return data.categories.find((c) => c.name === cat)?.color ?? 'ctp-overlay1';
	};

	function applyFilter(key: string, value: string) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		// Full-page navigation (not client-side) is what keeps the filters in the URL.
		window.location.href = `${url.pathname}${url.search}`;
	}

	// ── Bulk categorisation ──────────────────────────────────────────────────
	// Rows selected in the table (twui's Table provides `selection` +
	// `selected`). The mapped rows carry `id`, and that is what goes to the
	// server.
	let selected = $state<Record<string, unknown>[]>([]);
	let bulkCategory = $state('');
	let bulkSubmitting = $state(false);
	let bulkTags = $state<string[]>([]);
	let bulkTagSubmitting = $state(false);

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
			tags: tx.tags.map((t) => t.name),
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
			// Ticks every visible row while keeping the ones already selected on other
			// pages or under other filters.
			const existing = selected.filter((s) => !visibleRows.some((r) => r.id === s.id));
			selected = [...existing, ...visibleRows];
		}
	}

	function clearSelection() {
		selected = [];
		bulkCategory = '';
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
		try {
			const body = new FormData();
			body.set('ids', selectedIds.join(','));
			body.set('category', bulkCategory.trim());
			if (createRules) body.set('create_rules', 'yes');
			const res = await fetch('/transactions?/bulkCategorize', {
				method: 'POST',
				body
			});
			const result = (await res.json()) as {
				data?: { error?: string; count?: number; ruleCount?: number };
			};
			if (!res.ok || result.data?.error) {
				toast.error(result.data?.error ?? 'Não foi possível categorizar.');
				return;
			}
			const count = result.data?.count ?? 0;
			const ruleCount = result.data?.ruleCount ?? 0;
			let msg = `${count} transa${count === 1 ? 'ção' : 'ções'} categorizad${count === 1 ? 'a' : 'as'}.`;
			if (ruleCount > 0) {
				msg += ` ${ruleCount} ${ruleCount === 1 ? 'regra criada' : 'regras criadas'}.`;
			}
			toast.success(msg);
			await invalidateAll();
			clearSelection();
		} finally {
			bulkSubmitting = false;
		}
	}

	async function submitBulkTag() {
		if (selectedIds.length === 0) return;
		bulkTagSubmitting = true;
		try {
			const body = new FormData();
			body.set('ids', selectedIds.join(','));
			body.set('tags', bulkTags.join(','));
			const res = await fetch('/transactions?/bulkTag', {
				method: 'POST',
				body
			});
			const result = (await res.json()) as {
				data?: { error?: string; count?: number };
			};
			if (!res.ok || result.data?.error) {
				toast.error(result.data?.error ?? 'Não foi possível salvar as tags.');
				return;
			}
			const count = result.data?.count ?? 0;
			toast.success(`Tags aplicadas a ${count} transa${count === 1 ? 'ção' : 'ções'}.`);
			await invalidateAll();
			clearSelection();
		} finally {
			bulkTagSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Transações: TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<header>
		<h1 class="font-mono text-2xl font-bold">Transações</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span>
			{visible.length} registros
			{#if (type || tag) && visible.length > 0}
				· total
				<span
					class={visible.reduce((sum, t) => sum + t.displayAmount, 0) >= 0
						? 'text-ctp-green'
						: 'text-ctp-red'}
				>
					<!-- Sum first, then take the magnitude. Summing Math.abs of each
					     row made a refund add to the expense total instead of
					     reducing it. -->
					{formatCurrency(Math.abs(visible.reduce((sum, t) => sum + t.displayAmount, 0)))}
				</span>
			{/if}
			{#if data.future.length > 0}
				· <a href={resolve('/upcoming')} class="text-accent hover:underline"
					>{data.future.length} lançamento{data.future.length === 1 ? '' : 's'} futuro{data.future
						.length === 1
						? ''
						: 's'}</a
				>
			{/if}
		</p>
	</header>

	<!-- Filters -->
	<div class="flex flex-col">
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
					{ value: '', label: 'Todas as tags' },
					...data.userTags.map((t) => ({ value: t.name, label: t.name }))
				]}
				bind:value={tag}
				filter
				filterPlaceholder="Buscar tag…"
			/>
		</div>
		<div class="flex flex-wrap items-center gap-2 lg:flex-nowrap">
			<Select
				class="w-44"
				options={[
					{ value: '', label: 'Todos os tipos' },
					{ value: 'income', label: 'Receitas' },
					{ value: 'expenses', label: 'Despesas' }
				]}
				bind:value={type}
			/>
			<DatePicker class="w-44" mode="month" placeholder="Todos os meses" bind:value={month} />
			<Toggle
				class="text-nowrap"
				bind:checked={showInternal}
				label="Exibir transações internas"
				disabled={type === 'income' || type === 'expenses'}
			/>
			<a href={resolve('/transactions')} class="ml-auto">
				<Button variant="ghost">Limpar</Button>
			</a>
		</div>
	</div>

	<!-- Bulk categorisation — appears when rows are selected -->
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
			<TagInput
				class="w-64"
				bind:value={bulkTags}
				options={data.userTags.map((t) => t.name)}
				placeholder="Tags…"
				aria-label="Tags em lote"
			/>
			<Button
				variant="outline"
				disabled={bulkTags.length === 0 || bulkTagSubmitting}
				onclick={submitBulkTag}
			>
				{bulkTagSubmitting ? 'Aplicando…' : 'Aplicar tags'}
			</Button>
			<Button variant="ghost" onclick={clearSelection}>Cancelar</Button>
		</div>
	{/if}

	<!-- Table -->
	<div class="overflow-x-auto border border-rule bg-paper-raised">
		<Table
			columns={[
				{ key: 'date', label: 'Data', sortable: true },
				{ key: 'description', label: 'Descrição' },
				{ key: 'category', label: 'Categoria' },
				{ key: 'tags', label: 'Tags' },
				{ key: 'amount', label: 'Valor', sortable: true },
				{ key: 'action', label: '' }
			]}
			rows={visibleRows}
			widths={[1.2, 2.5, 1.2, 1.2, 1, 0.5]}
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
				{:else if key === 'tags'}
					{#if Array.isArray(row.tags) && (row.tags as string[]).length > 0}
						<div class="flex flex-wrap gap-1">
							{#each row.tags as tagName (tagName)}
								<a
									href={resolve(`/transactions?tag=${encodeURIComponent(tagName)}`)}
									class="border border-rule bg-paper px-1.5 py-0.5 font-mono text-xs text-ink-soft hover:text-accent hover:underline"
									onclick={(e) => e.stopPropagation()}>{tagName}</a
								>
							{/each}
						</div>
					{:else}
						<span class="text-xs text-ink-faint">—</span>
					{/if}
				{:else if key === 'amount'}
					<span class={Number(row.amount) >= 0 ? 'text-ctp-green' : 'text-ctp-red'}>
						{formatCurrency(Number(row.amount))}
					</span>
				{:else if key === 'action'}
					<!-- Explicit action to open the detail — clicking the row selects,
				     clicking the button navigates (no conflict). -->
					<a
						href={resolve(`/transactions/${row.id}`)}
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

		{#if data.windowed}
			<!-- Said out loud rather than silently truncated: a bounded list that
			     looks complete is worse than a slower one.
			     Reads as a footer strip rather than loose text: `mt-3` alone gave 12px
			     above and nothing below, so the line sat on the container's bottom
			     border. The border-top + padding match the Table's own pagination bar. -->
			<p class="border-t border-rule px-4 py-2.5 text-center font-mono text-xs text-ink-faint">
				Mostrando os últimos {data.windowMonths} meses.
				<button
					type="button"
					class="text-accent hover:underline"
					onclick={() => applyFilter('window', 'all')}
				>
					Ver todo o histórico
				</button>
			</p>
		{/if}
	</div>
</div>

<!-- Closing by X/Esc/overlay leaves `showRuleDialog` false and submits nothing,
     so dismissing the dialog cancels the whole action rather than falling
     through to the categorise-only path. -->
<Dialog bind:open={showRuleDialog} title="Criar regra automática?">
	<div class="flex flex-col gap-3">
		<p class="text-justify font-mono text-sm text-ink-soft">
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
