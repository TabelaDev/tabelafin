<script lang="ts">
	import Chart from '$lib/Chart.svelte';
	import { Card, Input, Select, Table } from '@tabeladev/tabelawebui';
	import { formatCompactCurrency, formatCurrency, formatCurrencyLabel } from '$lib/format';
	import type { ApexOptions } from 'apexcharts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(ts: Date | string): string {
		const d = typeof ts === 'string' ? new Date(ts) : ts;
		return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	// Invoice month key, YYYY-MM. Everything on this page groups by it.
	function monthKey(ts: Date | string): string {
		const d = typeof ts === 'string' ? new Date(ts) : ts;
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	}

	function monthLabel(key: string): string {
		const [y, m] = key.split('-').map(Number);
		const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
			month: 'long',
			year: 'numeric'
		});
		return label.charAt(0).toUpperCase() + label.slice(1);
	}

	// ── Filters (client-side) ─────────────────────────────────────────────────
	// All of them derive from `data.future`, which already arrives whole. Doing
	// the month grouping on the server instead would leave the chart blind to
	// these filters — it would keep drawing the unfiltered totals.
	let searchQuery = $state('');
	let monthFilter = $state('');
	let accountFilter = $state('');

	const monthKeys = $derived([...new Set(data.future.map((tx) => monthKey(tx.date)))].sort());

	const monthOptions = $derived([
		{ value: '', label: 'Todas as faturas' },
		...monthKeys.map((k) => ({ value: k, label: monthLabel(k) }))
	]);

	const accountOptions = $derived([
		{ value: '', label: 'Todos os cartões' },
		...[...new Set(data.future.map((tx) => tx.accountName).filter(Boolean))].map((name) => ({
			value: String(name),
			label: String(name)
		}))
	]);

	const filtered = $derived(
		data.future.filter((tx) => {
			if (monthFilter && monthKey(tx.date) !== monthFilter) return false;
			if (accountFilter && tx.accountName !== accountFilter) return false;
			if (
				searchQuery.trim() &&
				!tx.description.toLowerCase().includes(searchQuery.trim().toLowerCase())
			) {
				return false;
			}
			return true;
		})
	);

	const filteredTotal = $derived(filtered.reduce((sum, tx) => sum + Math.abs(tx.amount), 0));

	// Grouped by card account, the way the Nubank app shows each invoice. Reads
	// from `filtered` so the per-card cards follow the filters too.
	const futureByAccount = $derived.by(() => {
		const byId: Record<string, { name: string; total: number; count: number }> = {};
		for (const tx of filtered) {
			const key = tx.accountId ?? 'outros';
			const entry = byId[key] ?? { name: '', total: 0, count: 0 };
			entry.name = tx.accountName ?? '';
			entry.total += Math.abs(tx.amount);
			entry.count += 1;
			byId[key] = entry;
		}
		return Object.entries(byId)
			.map(([id, e]) => ({ id, ...e }))
			.sort((a, b) => b.total - a.total);
	});

	// ── Histogram by invoice month ────────────────────────────────────────────
	// Months come from the filtered set, so the chart tracks the filters. The
	// month filter itself is left out of the chart's own input on purpose: with
	// it applied the chart would collapse to a single bar and stop being a
	// comparison.
	const chartSource = $derived(
		data.future.filter((tx) => {
			if (accountFilter && tx.accountName !== accountFilter) return false;
			if (
				searchQuery.trim() &&
				!tx.description.toLowerCase().includes(searchQuery.trim().toLowerCase())
			) {
				return false;
			}
			return true;
		})
	);

	const byMonth = $derived.by(() => {
		// Plain object rather than a Map: the lint rule bans mutable built-in Maps
		// in components, and this matches how futureByAccount groups just above.
		const totals: Record<string, number> = {};
		for (const tx of chartSource) {
			const key = monthKey(tx.date);
			totals[key] = (totals[key] ?? 0) + Math.abs(tx.amount);
		}
		return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
	});

	const monthSeries = $derived([{ name: 'Gasto futuro', data: byMonth.map(([, total]) => total) }]);

	// Red: these are all expenses, and it is the colour this page's own table
	// already uses for the values — green here would contradict the app's rule
	// that red means money going out.
	const monthChartOptions = $derived<ApexOptions>({
		chart: { type: 'bar' },
		colors: ['#e64553'],
		plotOptions: { bar: { horizontal: false, borderRadius: 2, columnWidth: '55%' } },
		xaxis: { categories: byMonth.map(([key]) => monthLabel(key)) },
		dataLabels: {
			enabled: true,
			formatter: formatCurrencyLabel,
			style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }
		},
		legend: { show: false }
	});
</script>

<svelte:head>
	<title>Próximas faturas — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<header>
		<h1 class="font-mono text-2xl font-bold">Próximas faturas</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span>
			{data.future.length}
			{data.future.length === 1 ? 'lançamento futuro' : 'lançamentos futuros'}
		</p>
	</header>

	{#if data.future.length === 0}
		<Card>
			<Card.Content>
				<p class="py-8 text-center font-mono text-sm text-ink-soft">
					Nenhum lançamento futuro. As próximas faturas do cartão aparecem aqui quando o banco
					pré-lançar as parcelas.
				</p>
			</Card.Content>
		</Card>
	{:else}
		<!-- Resumo por conta -->
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<Card>
				<Card.Content>
					<p class="font-mono text-xs text-ink-soft">
						{monthFilter ? `Fatura de ${monthLabel(monthFilter)}` : 'Total futuro'}
					</p>
					<p class="mt-1 font-mono text-xl font-bold text-accent">
						{formatCompactCurrency(
							monthFilter || accountFilter || searchQuery.trim() ? filteredTotal : data.total
						)}
					</p>
					{#if monthFilter || accountFilter || searchQuery.trim()}
						<p class="font-mono text-xs text-ink-faint">
							de {formatCompactCurrency(data.total)} no total
						</p>
					{/if}
				</Card.Content>
			</Card>
			{#each futureByAccount as acc (acc.id)}
				<Card>
					<Card.Content>
						<p class="truncate font-mono text-xs text-ink-soft">{acc.name || 'Sem conta'}</p>
						<p class="mt-1 font-mono text-xl font-bold">
							{formatCompactCurrency(acc.total)}
						</p>
						<p class="font-mono text-xs text-ink-faint">{acc.count}x parcelas</p>
					</Card.Content>
				</Card>
			{/each}
		</div>

		<!-- Gastos futuros por mês de fatura -->
		{#if byMonth.length > 1}
			<Card>
				<Card.Content>
					<div>
						<h2 class="font-mono text-sm font-semibold">Gastos por fatura</h2>
						<p class="font-mono text-xs text-ink-soft">
							{byMonth.length} meses com parcelas pré-lançadas
						</p>
					</div>
					<div class="mt-2 min-h-56 flex-1">
						<Chart type="bar" series={monthSeries} options={monthChartOptions} />
					</div>
				</Card.Content>
			</Card>
		{/if}

		<!-- Filtros -->
		<div class="flex flex-wrap items-center gap-2">
			<Input
				bind:value={searchQuery}
				placeholder="Buscar descrição..."
				class="w-full min-w-40 sm:w-64"
			/>
			<Select class="w-52" options={monthOptions} bind:value={monthFilter} />
			<Select class="w-56" options={accountOptions} bind:value={accountFilter} />
			<p class="font-mono text-xs text-ink-soft">
				{filtered.length}
				{filtered.length === 1 ? 'lançamento' : 'lançamentos'}
			</p>
		</div>

		<!-- Lista -->
		<div class="overflow-x-auto border border-rule bg-paper-raised">
			<Table
				columns={[
					{ key: 'date', label: 'Data', sortable: true },
					{ key: 'description', label: 'Descrição' },
					{ key: 'accountName', label: 'Cartão', sortable: true },
					{ key: 'amount', label: 'Valor', sortable: true }
				]}
				rows={/* `date` goes in as a timestamp and is formatted in the `cell`
				       snippet: the Table only compares numerically between two numbers,
				       and with the date pre-formatted it fell through to localeCompare
				       and ordered by month name. */
				filtered.map((tx) => ({
					id: tx.id,
					date: new Date(tx.date).getTime(),
					description: tx.description,
					accountName: tx.accountName ?? '—',
					amount: tx.amount
				}))}
				rowKey="id"
				pageSize={25}
				pageSizeOptions={[10, 25, 50]}
			>
				{#snippet cell(row: Record<string, unknown>, key: string)}
					{#if key === 'date'}
						<span class="text-xs text-ink-soft">{formatDate(new Date(Number(row.date)))}</span>
					{:else if key === 'amount'}
						<span class="font-mono text-sm text-ctp-red">{formatCurrency(Number(row.amount))}</span>
					{:else if key === 'accountName'}
						<span class="text-xs text-ink-faint">{row.accountName}</span>
					{:else}
						{row.description}
					{/if}
				{/snippet}
				{#snippet empty()}
					<p class="py-12 text-center font-mono text-sm text-ink-soft">
						Nenhum lançamento encontrado para os filtros.
					</p>
				{/snippet}
			</Table>
		</div>
	{/if}
</div>
