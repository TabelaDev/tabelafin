<script lang="ts">
	import Chart from '$lib/components/Chart.svelte';
	import { horizontalBarOptions } from '$lib/client/charts';
	import { resolve } from '$app/paths';
	import { Card, Select } from '@tabeladev/tabelawebui';
	import { formatCurrency } from '$lib/lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Gastos (expense) vs Receitas (income) por categoria — o toggle mora no card.
	let direction: 'expense' | 'income' = $state('expense');
	const isExpense = $derived(direction === 'expense');

	// Categories the user hid by clicking the legend. The hidden bar's data
	// point is nulled out (so it stops rendering) while its slot stays in the
	// legend — clicking the item again restores it. ApexCharts can't toggle
	// individual bars of a `distributed` chart natively, so the page re-renders.
	let hidden = $state<string[]>([]);

	// Only categories with movement make the chart — the R$ 0,00 ones are noise.
	const withMovement = $derived(
		data.categories.filter((c) => (isExpense ? c.expense > 0 : c.income > 0))
	);
	const total = $derived(
		withMovement
			.filter((c) => !hidden.includes(c.name))
			.reduce((sum, c) => sum + (isExpense ? c.expense : c.income), 0)
	);

	// Horizontal histogram: one bar per category, in descending order.
	const sorted = $derived(
		[...withMovement].sort(
			(a, b) => (isExpense ? b.expense : b.income) - (isExpense ? a.expense : a.income)
		)
	);

	const toggleCategory = (index: number) => {
		const name = sorted[index]?.name;
		if (!name) return;
		hidden = hidden.includes(name) ? hidden.filter((n) => n !== name) : [...hidden, name];
	};

	const series = $derived([
		{
			name: isExpense ? 'Gasto' : 'Receita',
			data: sorted.map((c) => (hidden.includes(c.name) ? null : isExpense ? c.expense : c.income))
		}
	]);
	const options = $derived(
		horizontalBarOptions({
			categories: sorted.map((c) => c.name),
			distributed: true,
			showLegend: true
		})
	);

	// Height scales with the number of bars so a long category list never gets
	// crammed into a fixed box — each bar gets ~36px, plus room for the legend.
	const chartHeight = $derived(Math.max(240, sorted.length * 36 + 48));
</script>

<svelte:head>
	<title>Categorias — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<header>
		<h1 class="font-mono text-2xl font-bold">Categorias</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span>
			{isExpense ? 'Distribuição dos seus gastos' : 'Distribuição das suas receitas'} por categoria
		</p>
	</header>

	<Card>
		<Card.Header>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 class="font-mono text-sm font-semibold">
						{isExpense ? 'Gastos' : 'Receitas'} por categoria
					</h2>
					<p class="font-mono text-xs text-ink-soft">Total: {formatCurrency(total)}</p>
				</div>
				<div class="flex items-center gap-3">
					<Select
						class="w-36"
						options={[
							{ value: 'expense', label: 'Gastos' },
							{ value: 'income', label: 'Receitas' }
						]}
						bind:value={direction}
						aria-label="Direção"
					/>
					<a
						href={resolve('/categories/manage')}
						class="font-mono text-xs text-accent hover:underline">Gerenciar</a
					>
				</div>
			</div>
		</Card.Header>

		<Card.Content>
			<div class="mt-2" style={`height: ${chartHeight}px`}>
				{#if series[0].data.length > 0}
					<Chart type="bar" {series} {options} onLegendClick={toggleCategory} />
				{:else}
					<p class="py-12 text-center font-mono text-sm text-ink-soft">Sem dados ainda.</p>
				{/if}
			</div>
		</Card.Content>
	</Card>
</div>
