<script lang="ts">
	import { resolve } from '$app/paths';
	import { signedBalance } from '$lib/accounts';
	import { formatCompactCurrency } from '$lib/format';
	import { Accordion, Badge, Button, Card, Input, Select, Table } from '@tabeladev/tabelawebui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

	const typeLabel: Record<string, string> = {
		checking: 'Conta corrente',
		credit_card: 'Cartão de crédito',
		investment: 'Investimentos'
	};

	function amountClass(n: number): string {
		if (n > 0) return 'font-mono text-sm text-ctp-green';
		if (n < 0) return 'font-mono text-sm text-ctp-red';
		return 'font-mono text-sm';
	}

	// Filters are client-side: the whole account list already comes down in the
	// load, so filtering here costs nothing and keeps focus in the search box.
	let searchQuery = $state('');
	let typeFilter = $state('');
	let institutionFilter = $state('');

	const institutions = $derived([...new Set(data.accounts.map((a) => a.institution))].sort());

	const institutionOptions = $derived([
		{ value: '', label: 'Todas as instituições' },
		...institutions.map((i) => ({ value: i, label: i }))
	]);

	const typeOptions = [
		{ value: '', label: 'Todos os tipos' },
		{ value: 'checking', label: 'Conta corrente' },
		{ value: 'credit_card', label: 'Cartão de crédito' },
		{ value: 'investment', label: 'Investimentos' }
	];

	const filteredAccounts = $derived(
		data.accounts.filter((a) => {
			if (typeFilter && a.type !== typeFilter) return false;
			if (institutionFilter && a.institution !== institutionFilter) return false;
			if (searchQuery.trim() && !a.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
				return false;
			}
			return true;
		})
	);

	const rows = $derived(
		filteredAccounts.map((a) => ({
			id: a.id,
			name: a.name,
			institution: a.institution,
			type: typeLabel[a.type] ?? a.type,
			// Signed: the card's open invoice is a debt, and on the raw balance
			// it showed up green as if it were money available to spend.
			balance: signedBalance(a)
		}))
	);

	// Sum of what is on screen, so a filtered view reports its own subtotal
	// instead of leaving the summary cards to answer for the whole portfolio.
	const filteredTotal = $derived(rows.reduce((sum, r) => sum + r.balance, 0));

	const hasFilters = $derived(!!(searchQuery.trim() || typeFilter || institutionFilter));

	const investmentCount = $derived(data.accounts.filter((a) => a.type === 'investment').length);
</script>

<svelte:head>
	<title>Contas — TabelaFin</title>
</svelte:head>

{#snippet investmentExplainer()}
	<p class="font-mono text-xs text-ink-soft">
		Produtos de investimento conectados via Open Finance (CDB, Tesouro Direto, fundos, ações)
		aparecem como contas individuais — {investmentCount} das {data.accounts.length} contas aqui são ativos
		separados da mesma corretora. Use o filtro de tipo pra ver só conta corrente e cartão.
	</p>
{/snippet}

<div class="flex flex-col gap-4">
	<header>
		<h1 class="font-mono text-2xl font-bold">Contas</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span>
			{data.accounts.length}
			{data.accounts.length === 1 ? 'conta' : 'contas'} sincronizadas
		</p>
	</header>

	<!-- Cards de resumo -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<Card>
			<p class="font-mono text-xs text-ink-soft">Saldo total</p>
			<p class="mt-1 font-mono text-xl font-bold">
				{formatCompactCurrency(data.summary.total)}
			</p>
		</Card>
		<Card>
			<p class="font-mono text-xs text-ink-soft">Conta corrente</p>
			<p class="mt-1 font-mono text-xl font-bold">
				{formatCompactCurrency(data.summary.checking)}
			</p>
		</Card>
		<Card>
			<p class="font-mono text-xs text-ink-soft">Investimentos</p>
			<p class="mt-1 font-mono text-xl font-bold">
				{formatCompactCurrency(data.summary.investment)}
			</p>
		</Card>
		<Card>
			<p class="font-mono text-xs text-ink-soft">Cartão de crédito</p>
			{#if data.summary.credit > 0}
				<p class="mt-1 font-mono text-xl font-bold text-ctp-red">
					-{formatCompactCurrency(data.summary.credit)}
				</p>
			{:else}
				<p class="mt-1 font-mono text-xl font-bold">{formatCompactCurrency(data.summary.credit)}</p>
			{/if}
			<p class="font-mono text-xs text-ink-faint">fatura em aberto (dívida)</p>
		</Card>
	</div>

	<!-- Por que a lista é tão longa: cada produto de investimento do Open
	     Finance vira uma conta própria. -->
	{#if investmentCount > 0}
		<Accordion
			items={[
				{
					value: 'investimentos',
					title: `Por que tenho ${data.accounts.length} contas?`,
					content: investmentExplainer
				}
			]}
		/>
	{/if}

	<!-- Filtros -->
	<div class="flex flex-wrap items-center gap-2 lg:flex-nowrap">
		<Input bind:value={searchQuery} placeholder="Buscar conta..." class="w-full min-w-40 sm:w-64" />
		<Select class="w-48" options={typeOptions} bind:value={typeFilter} />
		<Select
			class="w-56"
			options={institutionOptions}
			bind:value={institutionFilter}
			filter
			filterPlaceholder="Buscar instituição…"
		/>
		{#if hasFilters}
			<p class="shrink-0 font-mono text-xs text-ink-soft">
				{rows.length}
				{rows.length === 1 ? 'conta' : 'contas'} · {currency.format(filteredTotal)}
			</p>
		{/if}
		<a href={resolve('/accounts')} class="ml-auto">
			<Button variant="ghost">Limpar</Button>
		</a>
	</div>

	<!-- Tabela de contas -->
	<div class="overflow-x-auto border border-rule bg-paper-raised">
		<Table
			widths={[4, 1, 1.5, 1]}
			columns={[
				{ key: 'name', label: 'Conta', sortable: true },
				{ key: 'institution', label: 'Instituição', sortable: true },
				{ key: 'type', label: 'Tipo', sortable: true },
				{ key: 'balance', label: 'Saldo', sortable: true }
			]}
			{rows}
			rowKey="id"
			pageSize={10}
			pageSizeOptions={[10, 25, 50, 100]}
		>
			{#snippet cell(row: Record<string, unknown>, key: string)}
				{#if key === 'name'}
					<span class="font-medium">{row.name}</span>
				{:else if key === 'type'}
					<Badge>[{row.type}]</Badge>
				{:else if key === 'balance'}
					<span class={amountClass(Number(row.balance))}>
						{currency.format(Number(row.balance))}
					</span>
				{:else}
					<span class="text-xs text-ink-soft">{row.institution}</span>
				{/if}
			{/snippet}
			{#snippet empty()}
				<p class="py-12 text-center font-mono text-sm text-ink-soft">
					{data.accounts.length === 0
						? 'Nenhuma conta ainda. Conecte via Open Finance.'
						: 'Nenhuma conta encontrada para os filtros.'}
				</p>
			{/snippet}
		</Table>
	</div>
</div>
