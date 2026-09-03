<script lang="ts">
	import Chart from '$lib/components/Chart.svelte';
	import { ChartType } from '$lib/enums/chart-type';
	import {
		formatCompactCurrency,
		formatCurrency,
		formatCurrencyLabel,
		formatDate,
		monthLabel,
		toYearMonth
	} from '$lib/utils/format';

	import { Card, Input, Page, Select, StatTile, Table } from '@tabelhadev/tabelhawebui';
	import type { ApexOptions } from 'apexcharts';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ── Filters (client-side) ─────────────────────────────────────────────────
	// All of them derive from `data.future`, which already arrives whole. Doing
	// the month grouping on the server instead would leave the chart blind to
	// these filters — it would keep drawing the unfiltered totals.
	let searchQuery = $state('');
	let monthFilter = $state('');
	let accountFilter = $state('');

	const monthKeys = $derived([...new Set(data.future.map((tx) => toYearMonth(tx.date)))].sort());

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
			if (monthFilter && toYearMonth(tx.date) !== monthFilter) return false;
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

	// Grouped by card account, the way the card issuer shows each invoice. Reads
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
			const key = toYearMonth(tx.date);
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
	<title>Parcelas futuras: TabelaFin</title>
</svelte:head>

<Page.Shell>
	<Page.Header
		title="Parcelas futuras"
		subtitle="{data.future.length} {data.future.length === 1
			? 'parcela pré-datada'
			: 'parcelas pré-datadas'}: a fatura do banco também inclui as compras à vista do ciclo"
	/>

	{#if data.future.length === 0}
		<Card>
			<Card.Content>
				<p class="py-8 text-center font-mono text-sm text-ink-soft">
					Nenhuma parcela pré-datada. Elas aparecem aqui quando o banco pré-lançar as parcelas.
				</p>
			</Card.Content>
		</Card>
	{:else}
		<!-- Summary by account -->
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<StatTile
				label={monthFilter ? `Fatura de ${monthLabel(monthFilter)}` : 'Parcelas futuras'}
				value={formatCompactCurrency(
					monthFilter || accountFilter || searchQuery.trim() ? filteredTotal : data.total
				)}
				valueClass="text-accent"
			>
				{#snippet footer()}
					{#if monthFilter || accountFilter || searchQuery.trim()}
						<span>de {formatCompactCurrency(data.total)} no total</span>
					{/if}
				{/snippet}
			</StatTile>
			{#each futureByAccount as acc (acc.id)}
				<StatTile label={acc.name || 'Sem conta'} value={formatCompactCurrency(acc.total)}>
					{#snippet footer()}
						<span>{acc.count}x parcelas</span>
					{/snippet}
				</StatTile>
			{/each}
		</div>

		<!-- Future spending by invoice month -->
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
						<Chart type={ChartType.Bar} series={monthSeries} options={monthChartOptions} />
					</div>
				</Card.Content>
			</Card>
		{/if}

		<!-- Filters -->
		<div class="flex flex-wrap items-center gap-2 lg:flex-nowrap">
			<Input
				bind:value={searchQuery}
				placeholder="Buscar descrição..."
				class="w-full min-w-40 sm:w-64"
			/>
			<Select
				class="w-52"
				options={monthOptions}
				bind:value={monthFilter}
				filter
				filterPlaceholder="Buscar mês…"
			/>
			<Select
				class="w-56"
				options={accountOptions}
				bind:value={accountFilter}
				filter
				filterPlaceholder="Buscar cartão…"
			/>
		</div>

		<!-- List -->
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
				pageSize={10}
				pageSizeOptions={[10, 25, 50]}
				labels={{ empty: 'Nenhum lançamento encontrado para os filtros.' }}
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
			</Table>
		</div>
	{/if}
</Page.Shell>
