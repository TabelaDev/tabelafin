<script lang="ts">
	import { horizontalBarOptions } from '$lib/client/charts';
	import Chart from '$lib/components/Chart.svelte';
	import { ChartType } from '$lib/enums/chart-type';
	import { formatCurrency } from '$lib/utils/format';

	import { resolve } from '$app/paths';
	import { Card, Page, Select } from '@tabelhadev/tabelhawebui';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Expenses (expense) vs Income by category — the toggle lives in the card.
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
	<title>Categorias: TAbelhaFin</title>
</svelte:head>

<Page.Shell>
	<Page.Header
		title="Categorias"
		subtitle="{isExpense
			? 'Distribuição dos seus gastos'
			: 'Distribuição das suas receitas'} por categoria"
	/>

	<!-- Management entry points, side by side (like the profile's AI card). -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<a href={resolve('/categories/manage')} class="block">
			<Card>
				<Card.Header>
					<div>
						<Card.Title>Categorias</Card.Title>
						<Card.Description>Crie, renomeie ou exclua suas categorias.</Card.Description>
					</div>
					<Card.Action navigate />
				</Card.Header>
			</Card>
		</a>
		<a href={resolve('/categories/rules')} class="block">
			<Card>
				<Card.Header>
					<div>
						<Card.Title>Regras automáticas</Card.Title>
						<Card.Description
							>Ensine o app a categorizar automaticamente pela descrição.</Card.Description
						>
					</div>
					<Card.Action navigate />
				</Card.Header>
			</Card>
		</a>
	</div>

	<Card>
		<Card.Header>
			<div>
				<Card.Title>{isExpense ? 'Gastos' : 'Receitas'} por categoria</Card.Title>
				<Card.Description>Total: {formatCurrency(total)}</Card.Description>
			</div>
			<Card.Action>
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
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<div style={`height: ${chartHeight}px`}>
				{#if series[0].data.length > 0}
					<Chart type={ChartType.Bar} {series} {options} onLegendClick={toggleCategory} />
				{:else}
					<p class="py-12 text-center font-mono text-sm text-ink-soft">Sem dados ainda.</p>
				{/if}
			</div>
		</Card.Content>
	</Card>
</Page.Shell>
