<script lang="ts">
	import { horizontalBarOptions } from '$lib/client/charts';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import { ChartType } from '$lib/enums/chart-type';
	import { signedBalance } from '$lib/utils/accounts';
	import { getCategoryColor } from '$lib/utils/categories';
	import { formatCompactCurrency, formatCurrency, formatDate } from '$lib/utils/format';

	import { resolve } from '$app/paths';
	import { Button, Card, Page, StatTile, Table } from '@tabelhadev/tabelhawebui';
	import type { ApexOptions } from 'apexcharts';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The current month as YYYY-MM — used by the spending/income card links that
	// open the transactions page with the filters already applied.
	const currentMonth = $derived(
		`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
	);

	const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

	// Percentage change against the previous month.
	const expenseDelta = $derived.by(() => {
		if (data.summary.prevExpense === 0) return null;
		return (
			((data.summary.monthExpense - data.summary.prevExpense) / data.summary.prevExpense) * 100
		);
	});

	const barSeries = $derived([
		{ name: 'Gasto', data: data.summary.topCategories.map((c) => c.value) }
	]);
	const barOptions = $derived<ApexOptions>(
		horizontalBarOptions({
			categories: data.summary.topCategories.map((c) => c.name),
			barHeight: '60%',
			// Qualitative: ranking by bar length only, no value label on the tip.
			showValues: false
		})
	);

	const areaSeries = $derived([{ name: 'Saldo', data: data.summary.monthValues }]);
	const areaOptions = $derived<ApexOptions>({
		xaxis: { categories: data.summary.monthLabels },
		stroke: { curve: 'smooth', width: 2 }
	});

	// Donut: the top 5 categories above zero — the R$ 0,00 ones just clutter the
	// composition.
	const positiveCategories = $derived(
		Object.entries(data.summary.categoryTotals)
			.filter(([, v]) => v > 0)
			.sort(([, a], [, b]) => b - a)
	);
	const donutSeries = $derived(positiveCategories.slice(0, 5).map(([, v]) => v));
	const donutLabels = $derived(positiveCategories.slice(0, 5).map(([k]) => k));
	const donutOptions = $derived<ApexOptions>({
		labels: donutLabels,
		legend: { position: 'bottom', horizontalAlign: 'center' },
		// Tooltip same as other charts: currency value, mono (style comes from
		// Chart's base). `tooltip.y.formatter` only renders the value; Apex
		// already appends the slice's percentage on a donut.
		tooltip: {
			y: {
				formatter: (value) => formatCurrency(Number(value))
			}
		}
	});

	// When the side charts (top categories / composition) have nothing to render,
	// the balance trend takes the full width.
	const hasSideCharts = $derived(data.summary.topCategories.length > 0 || donutSeries.length > 0);
	const evolutionClass = $derived(hasSideCharts ? 'lg:col-span-2 lg:row-span-2' : 'lg:col-span-3');

	const categoryColor = (cat: string | null) => getCategoryColor(data.categories, cat);

	// Top 4 accounts by balance (there are 189 investment holdings — filter).
	// Sorted and shown on the signed axis: by raw balance the card's open
	// invoice competed for the top as if it were the largest account.
	const topAccounts = $derived(
		[...data.accounts]
			.map((a) => ({ ...a, balance: signedBalance(a) }))
			.sort((a, b) => b.balance - a.balance)
			.slice(0, 4)
	);

	// Negative = spending (red), positive = income (green).
	function amountClass(amount: number): string {
		return amount < 0 ? 'text-ctp-red' : 'text-ctp-green';
	}
</script>

<svelte:head>
	<title>Dashboard: TabelaFin</title>
</svelte:head>

<Page.Shell>
	<!-- Header -->
	<Page.Header title="Dashboard" subtitle={monthName}>
		{#snippet action()}
			<a href={resolve('/new')}>
				<Button variant="primary">+ Nova transação</Button>
			</a>
		{/snippet}
	</Page.Header>

	<!-- Summary cards -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Saldo total" value={formatCompactCurrency(data.summary.totalBalance)} />
		<StatTile
			label="Gastos do mês →"
			href={resolve(`/transactions?month=${currentMonth}&type=expenses`)}
			value={formatCurrency(data.summary.monthExpense)}
			valueClass="text-ctp-red"
		>
			{#snippet footer()}
				{#if expenseDelta !== null}
					<span class={expenseDelta > 0 ? 'text-ctp-red' : 'text-ctp-green'}>
						{expenseDelta > 0 ? '▲' : '▼'}
						{Math.abs(expenseDelta).toFixed(1)}% vs. mês anterior
					</span>
				{/if}
			{/snippet}
		</StatTile>
		<StatTile
			label="Receitas do mês →"
			href={resolve(`/transactions?month=${currentMonth}&type=income`)}
			value={formatCurrency(data.summary.monthIncome)}
			valueClass="text-ctp-green"
		/>
		<StatTile label="Investimentos" value={formatCompactCurrency(data.summary.investmentBalance)} />
	</div>

	<!-- Charts: 2x3 grid — evolution takes 2 columns × 2 rows; top categories
	     and composition stacked in the right column. Without side charts,
	     evolution takes full width and the grid does not force a 2nd row. -->
	<div class="grid grid-cols-1 gap-3 lg:grid-cols-3 {hasSideCharts && 'lg:grid-rows-2'}">
		{#if data.summary.monthValues.length > 0}
			<Card class={evolutionClass}>
				<Card.Header>
					<Card.Title>Evolução do saldo</Card.Title>
					<Card.Description>últimos 6 meses</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="min-h-56 flex-1">
						<Chart type={ChartType.Area} series={areaSeries} options={areaOptions} />
					</div>
				</Card.Content>
			</Card>
		{/if}

		{#if data.summary.topCategories.length > 0}
			<Card class="lg:col-span-1">
				<Card.Header>
					<div>
						<Card.Title>Top categorias</Card.Title>
						<Card.Description>maiores gastos do mês</Card.Description>
					</div>
					<Card.Action>
						<a href={resolve('/categories')} class="font-mono text-xs text-accent hover:underline"
							>ver todas</a
						>
					</Card.Action>
				</Card.Header>
				<Card.Content>
					<div class="min-h-40 flex-1">
						<Chart type={ChartType.Bar} series={barSeries} options={barOptions} />
					</div>
				</Card.Content>
			</Card>
		{/if}

		{#if donutSeries.length > 0}
			<Card class="lg:col-span-1">
				<Card.Header>
					<Card.Title>Composição de gastos</Card.Title>
					<Card.Description>por categoria</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="min-h-48 flex-1">
						<Chart type={ChartType.Donut} series={donutSeries} options={donutOptions} />
					</div>
				</Card.Content>
			</Card>
		{/if}
	</div>

	<!-- Accounts — first; "see all" leads to the dedicated page -->
	<Card>
		<Card.Header>
			<Card.Title>Contas</Card.Title>
			{#if data.accounts.length > 0}
				<Card.Action>
					<a href={resolve('/accounts')} class="font-mono text-xs text-accent hover:underline"
						>ver todas</a
					>
				</Card.Action>
			{/if}
		</Card.Header>

		<Card.Content>
			{#if data.accounts.length === 0}
				<p class="py-4 text-center font-mono text-sm text-ink-soft">
					Nenhuma conta ainda. Conecte via Open Finance ou adicione transações manualmente.
				</p>
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{#each topAccounts as account (account.id)}
						<a
							href={resolve('/accounts')}
							class="block border border-rule bg-paper p-3 transition-colors hover:border-accent"
						>
							<p class="truncate font-mono text-sm font-medium">{account.name}</p>
							<p class="font-mono text-xs text-ink-soft">{account.institution}</p>
							<p class="mt-2 font-mono text-sm">
								{formatCompactCurrency(account.balance)}
							</p>
						</a>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card>

	<!-- Recent transactions — real table -->
	<Card>
		<Card.Header>
			<Card.Title>Transações recentes</Card.Title>
			<Card.Action>
				<a href={resolve('/transactions')} class="font-mono text-xs text-accent hover:underline"
					>ver todas</a
				>
			</Card.Action>
		</Card.Header>

		<Card.Content>
			<Table
				columns={[
					{ key: 'date', label: 'Data', sortable: true },
					{ key: 'description', label: 'Descrição' },
					{ key: 'category', label: 'Categoria' },
					{ key: 'amount', label: 'Valor', sortable: true }
				]}
				rows={data.recentTransactions.map((tx) => ({
					id: tx.id,
					date: formatDate(tx.date),
					description: tx.description,
					category: tx.category,
					amount: tx.amount
				}))}
				pageSize={0}
				labels={{
					empty: 'Nenhuma transação ainda. Adicione uma manualmente ou conecte suas contas.'
				}}
			>
				{#snippet cell(row: Record<string, unknown>, key: string)}
					{#if key === 'date'}
						<span class="text-xs text-ink-soft">{row.date}</span>
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
						<span class={amountClass(Number(row.amount))}>{formatCurrency(Number(row.amount))}</span
						>
					{:else}
						{row.description}
					{/if}
				{/snippet}
			</Table>
		</Card.Content>
	</Card>
</Page.Shell>
