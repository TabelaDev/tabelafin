<script lang="ts">
	import CategoryBadge from '$lib/CategoryBadge.svelte';
	import { resolve } from '$app/paths';
	import Chart from '$lib/Chart.svelte';
	import { horizontalBarOptions } from '$lib/charts';
	import { Card, Table, Button } from '@tabeladev/tabelawebui';
	import type { ApexOptions } from 'apexcharts';
	import { formatCompactCurrency, formatCurrency } from '$lib/format';
	import { signedBalance } from '$lib/accounts';
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
			barHeight: '60%'
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
		// Tooltip igual aos outros gráficos: valor em moeda, mono (o estilo vem
		// from Chart's base). `tooltip.y.formatter` only renders the value; Apex
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

	function formatDate(ts: Date | string): string {
		const d = typeof ts === 'string' ? new Date(ts) : ts;
		return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	const categoryColor = (cat: string | null) => {
		if (!cat) return 'ctp-overlay1';
		return data.categories.find((c) => c.name === cat)?.color ?? 'ctp-overlay1';
	};

	// Top 4 accounts by balance (there are 189 investment holdings — filter).
	// Sorted and shown on the signed axis: by raw balance the card's open
	// invoice competed for the top as if it were the largest account.
	const topAccounts = $derived(
		[...data.accounts]
			.map((a) => ({ ...a, balance: signedBalance(a) }))
			.sort((a, b) => b.balance - a.balance)
			.slice(0, 4)
	);

	// Negativo = gasto (vermelho), positivo = entrada (verde).
	function amountClass(amount: number): string {
		return amount < 0 ? 'text-ctp-red' : 'text-ctp-green';
	}
</script>

<svelte:head>
	<title>Dashboard — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<!-- Header -->
	<header class="flex items-center justify-between">
		<div>
			<h1 class="font-mono text-2xl font-bold">Dashboard</h1>
			<p class="font-mono text-sm text-ink-soft">
				<span class="text-ink-faint">//</span>
				{monthName}
			</p>
		</div>
		<a href={resolve('/new')}>
			<Button variant="primary">+ Nova transação</Button>
		</a>
	</header>

	<!-- Cards de resumo -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<Card>
			<Card.Content>
				<p class="font-mono text-xs text-ink-soft">Saldo total</p>
				<p class="mt-1 font-mono text-xl font-bold">
					{formatCompactCurrency(data.summary.totalBalance)}
				</p>
			</Card.Content>
		</Card>
		<Card>
			<Card.Content>
				<a
					href={resolve(`/transactions?month=${currentMonth}&type=expenses`)}
					class="font-mono text-xs text-ink-soft underline underline-offset-4 transition-colors hover:text-accent"
				>
					Gastos do mês →
				</a>
				<p class="mt-1 font-mono text-xl font-bold text-ctp-red">
					{formatCurrency(data.summary.monthExpense)}
				</p>
				{#if expenseDelta !== null}
					<span class="font-mono text-xs {expenseDelta > 0 ? 'text-ctp-red' : 'text-ctp-green'}">
						{expenseDelta > 0 ? '▲' : '▼'}
						{Math.abs(expenseDelta).toFixed(1)}% vs. mês anterior
					</span>
				{/if}
			</Card.Content>
		</Card>
		<Card>
			<Card.Content>
				<a
					href={resolve(`/transactions?month=${currentMonth}&type=income`)}
					class="font-mono text-xs text-ink-soft underline underline-offset-4 transition-colors hover:text-accent"
				>
					Receitas do mês →
				</a>
				<p class="mt-1 font-mono text-xl font-bold text-ctp-green">
					{formatCurrency(data.summary.monthIncome)}
				</p>
			</Card.Content>
		</Card>
		<Card>
			<Card.Content>
				<p class="font-mono text-xs text-ink-soft">Investimentos</p>
				<p class="mt-1 font-mono text-xl font-bold">
					{formatCompactCurrency(data.summary.investmentBalance)}
				</p>
			</Card.Content>
		</Card>
	</div>

	<!-- Gráficos: grid 2x3 — evolução ocupa 2 colunas × 2 linhas; top categorias
	     e composição empilhadas na coluna da direita. Sem gráficos laterais,
	     evolução ocupa a largura toda e o grid não força a 2ª linha. -->
	<div class="grid grid-cols-1 gap-3 lg:grid-cols-3 {hasSideCharts && 'lg:grid-rows-2'}">
		{#if data.summary.monthValues.length > 0}
			<Card class={evolutionClass}>
				<Card.Content>
					<div>
						<h2 class="font-mono text-sm font-semibold">Evolução do saldo</h2>
						<p class="font-mono text-xs text-ink-soft">últimos 6 meses</p>
					</div>
					<div class="mt-2 min-h-56 flex-1">
						<Chart type="area" series={areaSeries} options={areaOptions} />
					</div>
				</Card.Content>
			</Card>
		{/if}

		{#if data.summary.topCategories.length > 0}
			<Card class="lg:col-span-1">
				<Card.Header>
					<div class="flex items-center justify-between">
						<div>
							<h2 class="font-mono text-sm font-semibold">Top categorias</h2>
							<p class="font-mono text-xs text-ink-soft">maiores gastos do mês</p>
						</div>
						<a href={resolve('/categories')} class="font-mono text-xs text-accent hover:underline"
							>ver todas</a
						>
					</div>
				</Card.Header>
				<Card.Content>
					<div class="mt-2 min-h-40 flex-1">
						<Chart type="bar" series={barSeries} options={barOptions} />
					</div>
				</Card.Content>
			</Card>
		{/if}

		{#if donutSeries.length > 0}
			<Card class="lg:col-span-1">
				<Card.Content>
					<div>
						<h2 class="font-mono text-sm font-semibold">Composição de gastos</h2>
						<p class="font-mono text-xs text-ink-soft">por categoria</p>
					</div>
					<div class="mt-2 min-h-48 flex-1">
						<Chart type="donut" series={donutSeries} options={donutOptions} />
					</div>
				</Card.Content>
			</Card>
		{/if}
	</div>

	<!-- Contas — primeiro; ver todas leva pra página dedicada -->
	<Card>
		<Card.Header>
			<div class="flex items-center justify-between">
				<h2 class="font-mono text-sm font-semibold">Contas</h2>
				{#if data.accounts.length > 0}
					<a href={resolve('/accounts')} class="font-mono text-xs text-accent hover:underline"
						>ver todas</a
					>
				{/if}
			</div>
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

	<!-- Transações recentes — tabela real -->
	<Card>
		<Card.Header>
			<div class="flex items-center justify-between">
				<h2 class="font-mono text-sm font-semibold">Transações recentes</h2>
				<a href={resolve('/transactions')} class="font-mono text-xs text-accent hover:underline"
					>ver todas</a
				>
			</div>
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
				{#snippet empty()}
					<p class="py-8 text-center font-mono text-sm text-ink-soft">
						Nenhuma transação ainda. Adicione uma manualmente ou conecte suas contas.
					</p>
				{/snippet}
			</Table>
		</Card.Content>
	</Card>
</div>
