<script lang="ts">
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import { handleAction } from '$lib/utils/forms';

	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button, Card, Checkbox, Page, Select, Table, toast } from '@tabelhadev/tabelhawebui';

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

<Page.Shell>
	<Page.Header
		title="Revisar extrato"
		subtitle="{data.review.filename} — {data.review.source === 'csv'
			? 'CSV'
			: data.review.source === 'single_pdf'
				? 'PDF'
				: 'Takeout'}"
		back={{ label: 'Extratos', href: resolve('/statements') }}
	>
		{#snippet action()}
			<div class="flex items-center gap-2">
				{#if data.review.status === 'ready'}
					<form method="POST" action="?/cancel" use:enhance={handleAction()}>
						<input type="hidden" name="reviewId" value={data.review.id} />
						<Button variant="ghost" size="sm" type="submit">Cancelar</Button>
					</form>
				{/if}
				<Button href={resolve('/statements')} variant="ghost" size="sm">Voltar</Button>
			</div>
		{/snippet}
	</Page.Header>

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
					<Table
						columns={[
							{ key: 'select', label: '' },
							{ key: 'date', label: 'Data' },
							{ key: 'description', label: 'Descrição' },
							{ key: 'amount', label: 'Valor' },
							{ key: 'category', label: 'Categoria' }
						]}
						rows={transactions}
						rowKey="id"
						pageSize={0}
					>
						{#snippet cell(row: Record<string, unknown>, key: string)}
							{@const tx = row as unknown as (typeof transactions)[number]}
							<div class={tx.selected ? '' : 'opacity-50'}>
								{#if key === 'select'}
									<Checkbox checked={tx.selected} onchange={() => toggleOne(tx.id)} />
								{:else if key === 'date'}
									<span class="whitespace-nowrap font-mono text-xs">{formatDate(tx.date)}</span>
								{:else if key === 'description'}
									<span class="block max-w-xs truncate font-mono text-xs">{tx.description}</span>
								{:else if key === 'amount'}
									<span
										class="block text-right font-mono text-xs whitespace-nowrap {tx.amount < 0
											? 'text-danger'
											: 'text-signal'}"
									>
										{formatCurrency(tx.amount)}
									</span>
								{:else if key === 'category'}
									<Select options={categoryOptions} bind:value={tx.category} class="!w-40" />
								{/if}
							</div>
						{/snippet}
					</Table>
				</div>
			</Card.Content>
		</Card>
	{/if}
</Page.Shell>
