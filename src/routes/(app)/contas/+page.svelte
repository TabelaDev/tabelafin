<script lang="ts">
	import { Card, Table, Badge } from '@tabeladev/tabelawebui';
	import { formatCompactCurrency } from '$lib/format';
	import { signedBalance } from '$lib/accounts';
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
</script>

<svelte:head>
	<title>Contas — TabelaFin</title>
</svelte:head>

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
			<p class="mt-1 font-mono text-xl font-bold text-ctp-red">
				-{formatCompactCurrency(data.summary.credit)}
			</p>
			<p class="font-mono text-xs text-ink-faint">fatura em aberto (dívida)</p>
		</Card>
	</div>

	<!-- Tabela de contas -->
	<div class="overflow-x-auto border border-rule bg-paper-raised">
		<Table
			widths={[4, 1, 3, 3]}
			columns={[
				{ key: 'name', label: 'Conta', sortable: true },
				{ key: 'institution', label: 'Instituição' },
				{ key: 'type', label: 'Tipo' },
				{ key: 'balance', label: 'Saldo', sortable: true }
			]}
			rows={data.accounts.map((a) => ({
				id: a.id,
				name: a.name,
				institution: a.institution,
				type: typeLabel[a.type] ?? a.type,
				// Signed: the card's open invoice is a debt, and on the raw balance
				// it showed up green as if it were money available to spend.
				balance: signedBalance(a)
			}))}
			pageSize={0}
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
					Nenhuma conta ainda. Conecte via Open Finance.
				</p>
			{/snippet}
		</Table>
	</div>
</div>
