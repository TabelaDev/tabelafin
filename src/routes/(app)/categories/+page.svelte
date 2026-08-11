<script lang="ts">
	import Chart from '$lib/Chart.svelte';
	import { resolve } from '$app/paths';
	import { Card } from '@tabeladev/tabelawebui';
	import { formatCurrencyLabel } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

	// Only categories with spending make the chart — the R$ 0,00 ones are noise.
	const withSpend = $derived(data.categories.filter((c) => c.total > 0));
	const total = $derived(withSpend.reduce((sum, c) => sum + c.total, 0));

	// Horizontal histogram: one bar per category, in descending order.
	const sorted = $derived([...withSpend].sort((a, b) => b.total - a.total));
	const series = $derived([{ name: 'Gasto', data: sorted.map((c) => c.total) }]);
	const options = $derived({
		chart: { type: 'bar' as const, stacked: false },
		plotOptions: {
			bar: { horizontal: true, borderRadius: 2 }
		},
		xaxis: { categories: sorted.map((c) => c.name) },
		dataLabels: {
			enabled: true,
			// Pushes the label outside the bar (to the right) so the value does not
			// sit on top of the accent-coloured bar.
			offsetX: 6,
			textAnchor: 'start' as const,
			formatter: formatCurrencyLabel,
			style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }
		},
		legend: { show: false }
	});
</script>

<svelte:head>
	<title>Categorias — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<header class="flex flex-wrap items-start justify-between gap-2">
		<div>
			<h1 class="font-mono text-2xl font-bold">Categorias</h1>
			<p class="font-mono text-sm text-ink-soft">
				<span class="text-ink-faint">//</span> Distribuição dos seus gastos por categoria
			</p>
		</div>
		<div class="flex items-center gap-3">
			<a
				href={resolve('/profile/categories/rules')}
				class="font-mono text-xs text-accent hover:underline">regras automáticas</a
			>
			<a href={resolve('/profile/categories')} class="font-mono text-xs text-accent hover:underline"
				>gerenciar categorias</a
			>
		</div>
	</header>

	<Card>
		<div>
			<h2 class="font-mono text-sm font-semibold">Gastos por categoria</h2>
			<p class="font-mono text-xs text-ink-soft">Total: {currency.format(total)}</p>
		</div>
		<div class="mt-2 min-h-64 flex-1">
			{#if series[0].data.length > 0}
				<Chart type="bar" {series} {options} />
			{:else}
				<p class="py-12 text-center font-mono text-sm text-ink-soft">Sem dados ainda.</p>
			{/if}
		</div>
	</Card>
</div>
