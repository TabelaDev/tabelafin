<script lang="ts">
	import { Card, Table } from '@tabeladev/tabelawebui';
	import { formatCompactCurrency } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

	// Agrupa por conta de cartão, como o app do Nubank mostra cada fatura.
	const futureByAccount = $derived.by(() => {
		const byId: Record<string, { name: string; total: number; count: number }> = {};
		for (const tx of data.future) {
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

	function formatDate(ts: Date | string): string {
		const d = typeof ts === 'string' ? new Date(ts) : ts;
		return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
	}
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
			<p class="py-8 text-center font-mono text-sm text-ink-soft">
				Nenhum lançamento futuro. As próximas faturas do cartão aparecem aqui quando o banco
				pré-lançar as parcelas.
			</p>
		</Card>
	{:else}
		<!-- Resumo por conta -->
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<Card>
				<p class="font-mono text-xs text-ink-soft">Total futuro</p>
				<p class="mt-1 font-mono text-xl font-bold text-accent">
					{formatCompactCurrency(data.total)}
				</p>
			</Card>
			{#each futureByAccount as acc (acc.id)}
				<Card>
					<p class="truncate font-mono text-xs text-ink-soft">{acc.name || 'Sem conta'}</p>
					<p class="mt-1 font-mono text-xl font-bold">
						{formatCompactCurrency(acc.total)}
					</p>
					<p class="font-mono text-xs text-ink-faint">{acc.count}x parcelas</p>
				</Card>
			{/each}
		</div>

		<!-- Lista -->
		<div class="overflow-x-auto border border-rule bg-paper-raised">
			<Table
				columns={[
					{ key: 'date', label: 'Data', sortable: true },
					{ key: 'description', label: 'Descrição' },
					{ key: 'accountName', label: 'Cartão' },
					{ key: 'amount', label: 'Valor', sortable: true }
				]}
				rows={data.future.map((tx) => ({
					id: tx.id,
					date: formatDate(tx.date),
					description: tx.description,
					accountName: tx.accountName ?? '—',
					amount: tx.amount
				}))}
				pageSize={0}
			>
				{#snippet cell(row: Record<string, unknown>, key: string)}
					{#if key === 'date'}
						<span class="text-xs text-ink-soft">{row.date}</span>
					{:else if key === 'amount'}
						<span class="font-mono text-sm text-ctp-red">{currency.format(Number(row.amount))}</span
						>
					{:else if key === 'accountName'}
						<span class="text-xs text-ink-faint">{row.accountName}</span>
					{:else}
						{row.description}
					{/if}
				{/snippet}
				{#snippet empty()}
					<p class="py-12 text-center font-mono text-sm text-ink-soft">Nenhum lançamento futuro.</p>
				{/snippet}
			</Table>
		</div>
	{/if}
</div>
