<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Badge, Button, Card, Checkbox, Select, toast } from '@tabeladev/tabelawebui';
	import { handleAction } from '$lib/utils/forms';

	let { data } = $props();

	let transactions = $state(
		data.transactions.map((tx, i) => ({
			...tx,
			selected: true,
			id: i
		}))
	);

	let submitting = $state(false);

	const categoryOptions = [
		{ value: '', label: 'Sem categoria' },
		{ value: 'Alimentação', label: 'Alimentação' },
		{ value: 'Moradia', label: 'Moradia' },
		{ value: 'Transporte', label: 'Transporte' },
		{ value: 'Saúde', label: 'Saúde' },
		{ value: 'Educação', label: 'Educação' },
		{ value: 'Lazer', label: 'Lazer' },
		{ value: 'Vestuário', label: 'Vestuário' },
		{ value: 'Serviços', label: 'Serviços' },
		{ value: 'Investimentos', label: 'Investimentos' },
		{ value: 'Transferências', label: 'Transferências' },
		{ value: 'Outros', label: 'Outros' }
	];

	const selectedCount = $derived(transactions.filter((tx) => tx.selected).length);
	const selectedTransactions = $derived(
		transactions.filter((tx) => tx.selected).map(({ id: _, selected: __, ...tx }) => tx)
	);

	function toggleAll() {
		const allSelected = transactions.every((tx) => tx.selected);
		transactions = transactions.map((tx) => ({ ...tx, selected: !allSelected }));
	}

	function toggleOne(id: number) {
		transactions = transactions.map((tx) =>
			tx.id === id ? { ...tx, selected: !tx.selected } : tx
		);
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('pt-BR', {
			style: 'currency',
			currency: 'BRL'
		}).format(amount / 100);
	}

	function formatDate(dateStr: string): string {
		const [y, m, d] = dateStr.split('-');
		return `${d}/${m}/${y}`;
	}

	async function applyTransactions() {
		submitting = true;
		try {
			const res = await fetch('/api/statements/apply', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reviewId: data.review.id,
					transactions: selectedTransactions
				})
			});

			if (!res.ok) {
				const err = (await res
					.json()
					.catch(() => ({ message: 'Erro ao aplicar transações.' }))) as { message?: string };
				toast.error(err.message || 'Erro ao aplicar transações.');
				return;
			}

			const result = (await res.json()) as { inserted: number; duplicates: number };
			toast.success(
				`${result.inserted} transações importadas. ${result.duplicates} duplicatas detectadas.`
			);
			goto(resolve('/transactions'));
		} catch {
			toast.error('Erro de conexão ao aplicar transações.');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Revisar extrato — tabelafin</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 p-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="font-mono text-xl font-semibold">Revisar extrato</h1>
			<p class="mt-1 font-mono text-sm text-ink-soft">
				{data.review.filename} — {data.review.source === 'csv'
					? 'CSV'
					: data.review.source === 'single_pdf'
						? 'PDF'
						: 'Takeout'}
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if data.review.status === 'ready'}
				<form method="POST" action="?/cancel" use:enhance={handleAction()}>
					<input type="hidden" name="reviewId" value={data.review.id} />
					<Button variant="ghost" size="sm" type="submit">Cancelar</Button>
				</form>
			{/if}
			<Button href={resolve('/statements')} variant="ghost" size="sm">Voltar</Button>
		</div>
	</div>

	{#if transactions.length === 0}
		<Card>
			<Card.Content>
				<p class="font-mono text-sm text-ink-soft">Nenhuma transação encontrada neste extrato.</p>
			</Card.Content>
		</Card>
	{:else}
		<Card>
			<Card.Content>
				<div class="flex items-center justify-between border-b border-rule pb-3">
					<div class="flex items-center gap-3">
						<Checkbox checked={transactions.every((tx) => tx.selected)} onchange={toggleAll} />
						<span class="font-mono text-sm">
							{selectedCount} de {transactions.length} transações selecionadas
						</span>
					</div>
					{#if data.review.status === 'ready'}
						<Button onclick={applyTransactions} loading={submitting} size="sm">
							Aplicar {selectedCount} transações
						</Button>
					{/if}
				</div>

				<div class="mt-3 max-h-[60vh] overflow-y-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-rule font-mono text-xs text-ink-soft">
								<th class="px-2 py-2 text-left"></th>
								<th class="px-2 py-2 text-left">Data</th>
								<th class="px-2 py-2 text-left">Descrição</th>
								<th class="px-2 py-2 text-right">Valor</th>
								<th class="px-2 py-2 text-left">Categoria</th>
							</tr>
						</thead>
						<tbody>
							{#each transactions as tx (tx.id)}
								<tr class="border-b border-rule last:border-b-0 {tx.selected ? '' : 'opacity-50'}">
									<td class="px-2 py-2">
										<Checkbox checked={tx.selected} onchange={() => toggleOne(tx.id)} />
									</td>
									<td class="px-2 py-2 font-mono text-xs whitespace-nowrap">
										{formatDate(tx.date)}
									</td>
									<td class="max-w-xs truncate px-2 py-2 font-mono text-xs">
										{tx.description}
									</td>
									<td
										class="px-2 py-2 text-right font-mono text-xs whitespace-nowrap {tx.amount < 0
											? 'text-danger'
											: 'text-signal'}"
									>
										{formatCurrency(tx.amount)}
									</td>
									<td class="px-2 py-2">
										<Select options={categoryOptions} bind:value={tx.category} class="!w-40" />
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card.Content>
		</Card>
	{/if}
</div>
