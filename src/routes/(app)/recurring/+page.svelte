<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button, Card, Input, Label, Select } from '@tabeladev/tabelawebui';
	import { formatCompactCurrency } from '$lib/lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showForm = $state(false);
	let description = $state('');
	let amount = $state('');
	let category = $state('');
	let frequency = $state('monthly');
	let nextChargeDate = $state('');

	const FREQUENCIES: { value: string; label: string }[] = [
		{ value: 'weekly', label: 'Semanal' },
		{ value: 'monthly', label: 'Mensal' },
		{ value: 'quarterly', label: 'Trimestral' },
		{ value: 'yearly', label: 'Anual' }
	];
	const FREQUENCY_LABELS: Record<string, string> = Object.fromEntries(
		FREQUENCIES.map((f) => [f.value, f.label])
	);

	// Display order of the frequencies.
	const GROUP_ORDER = ['monthly', 'weekly', 'quarterly', 'yearly'];

	// Agrupa as recorrências ativas por frequência, na ordem definida.
	const groups = $derived.by(() => {
		const byFreq: Record<string, typeof data.expenses> = {};
		for (const e of data.expenses) {
			if (!e.isActive) continue;
			(byFreq[e.frequency] ??= []).push(e);
		}
		return GROUP_ORDER.filter((f) => byFreq[f]).map((f) => ({
			frequency: f,
			label: FREQUENCY_LABELS[f] ?? f,
			items: byFreq[f].sort((a, b) => b.amount - a.amount)
		}));
	});

	const inactive = $derived(data.expenses.filter((e) => !e.isActive));

	const categoryColor = (name: string | null) => {
		if (!name) return null;
		return data.categories.find((c) => c.name === name)?.color ?? null;
	};
	const badgeStyle = (name: string | null) => {
		const color = categoryColor(name);
		if (!color) return '';
		return `background-color: color-mix(in oklab, var(--ctp-${color.replace(
			'ctp-',
			''
		)}) 10%, transparent); color: var(--ctp-${color.replace('ctp-', '')});`;
	};

	function formatDate(ts: Date | string | null): string {
		if (!ts) return '—';
		const d = typeof ts === 'string' ? new Date(ts) : ts;
		return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function resetForm() {
		description = '';
		amount = '';
		category = '';
		frequency = 'monthly';
		nextChargeDate = '';
		showForm = false;
	}
</script>

<svelte:head>
	<title>Recorrências — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<header class="flex items-center justify-between">
		<div>
			<h1 class="font-mono text-2xl font-bold">Recorrências</h1>
			<p class="font-mono text-sm text-ink-soft">
				<span class="text-ink-faint">//</span> Assinaturas e despesas fixas.
			</p>
		</div>
		<Button
			onclick={() => (showForm = !showForm)}
			variant={showForm ? 'outline' : 'primary'}
			size="sm"
		>
			{showForm ? 'Cancelar' : '+ Novo'}
		</Button>
	</header>

	<!-- Total mensal estimado -->
	{#if data.expenses.length > 0}
		<Card>
			<Card.Content>
				<div class="flex items-center justify-between">
					<span class="font-mono text-sm text-ink-soft">Total mensal estimado</span>
					<span class="font-mono text-lg font-bold text-accent">
						{formatCompactCurrency(data.monthlyTotal)}
					</span>
				</div>
			</Card.Content>
		</Card>
	{/if}

	<!-- Formulário de novo gasto recorrente -->
	{#if showForm}
		<Card>
			<Card.Content>
				<form
					method="POST"
					action="?/create"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								await invalidateAll();
								resetForm();
							}
						};
					}}
					class="flex flex-col gap-3"
				>
					<h2 class="font-mono text-sm font-semibold">Nova recorrência</h2>

					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div class="flex flex-col gap-1">
							<Label for="description">Descrição</Label>
							<Input
								id="description"
								name="description"
								bind:value={description}
								placeholder="Ex: Netflix, Spotify..."
								required
							/>
						</div>

						<div class="flex flex-col gap-1">
							<Label for="amount">Valor (R$)</Label>
							<Input
								id="amount"
								name="amount"
								type="number"
								step="0.01"
								min="0.01"
								bind:value={amount}
								placeholder="0,00"
								required
							/>
						</div>

						<div class="flex flex-col gap-1">
							<Label for="frequency">Frequência</Label>
							<Select
								id="frequency"
								name="frequency"
								options={FREQUENCIES}
								bind:value={frequency}
							/>
						</div>

						<div class="flex flex-col gap-1">
							<Label for="category">Categoria</Label>
							<Select
								id="category"
								name="category"
								options={[
									{ value: '', label: 'Sem categoria' },
									...data.categories.map((cat) => ({ value: cat.name, label: cat.name }))
								]}
								bind:value={category}
								filter
								filterPlaceholder="Buscar categoria…"
							/>
						</div>

						<div class="flex flex-col gap-1 sm:col-span-2">
							<Label for="nextChargeDate">Próxima cobrança</Label>
							<Input
								id="nextChargeDate"
								name="nextChargeDate"
								type="date"
								bind:value={nextChargeDate}
							/>
						</div>
					</div>

					{#if form?.error}
						<p class="font-mono text-sm text-danger">{form.error}</p>
					{/if}

					<div class="flex justify-end">
						<Button type="submit" size="sm">Adicionar</Button>
					</div>
				</form>
			</Card.Content>
		</Card>
	{/if}

	<!-- Lista agrupada por frequência -->
	{#if groups.length === 0 && inactive.length === 0}
		<Card>
			<Card.Content>
				<p class="py-4 text-center font-mono text-sm text-ink-soft">
					Nenhuma recorrência cadastrada ainda.
				</p>
			</Card.Content>
		</Card>
	{:else}
		{#each groups as group (group.frequency)}
			<section class="flex flex-col gap-2">
				<h2 class="font-mono text-sm font-semibold text-ink-soft">
					{group.label} · {group.items.length}
					{group.items.length === 1 ? 'recorrência' : 'recorrências'}
				</h2>
				<div class="flex flex-col gap-2">
					{#each group.items as expense (expense.id)}
						<Card>
							<Card.Content>
								<div class="flex items-center justify-between gap-4">
									<div class="flex min-w-0 flex-col gap-1">
										<span class="truncate font-mono text-sm font-medium">{expense.description}</span
										>
										<div class="flex flex-wrap items-center gap-2">
											{#if expense.category}
												<span
													class="border px-2 py-0.5 font-mono text-xs"
													style={badgeStyle(expense.category)}>[{expense.category}]</span
												>
											{/if}
											<span class="font-mono text-xs text-ink-soft">
												{formatCompactCurrency(expense.amount)}/mês
											</span>
										</div>
										<div class="flex items-center gap-2 font-mono text-xs text-ink-faint">
											<span>
												{expense.occurrences}
												{expense.occurrences === 1 ? 'ocorrência' : 'ocorrências'}
											</span>
											<span>·</span>
											<span>última: {formatDate(expense.lastOccurrence)}</span>
											{#if expense.nextChargeDate}
												<span>·</span>
												<span>próxima: {formatDate(expense.nextChargeDate)}</span>
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-3">
										<span class="font-mono text-sm font-semibold"
											>{formatCompactCurrency(expense.amount)}</span
										>
										<form method="POST" action="?/delete" use:enhance>
											<input type="hidden" name="id" value={expense.id} />
											<Button type="submit" variant="ghost" size="sm" class="text-danger">✕</Button>
										</form>
									</div>
								</div>
							</Card.Content>
						</Card>
					{/each}
				</div>
			</section>
		{/each}

		{#if inactive.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class="font-mono text-sm font-semibold text-ink-soft">
					Inativas · {inactive.length}
				</h2>
				<div class="flex flex-col gap-2">
					{#each inactive as expense (expense.id)}
						<Card class="opacity-60">
							<Card.Content>
								<div class="flex items-center justify-between gap-4">
									<span class="truncate font-mono text-sm">{expense.description}</span>
									<span class="font-mono text-sm">{formatCompactCurrency(expense.amount)}</span>
								</div>
							</Card.Content>
						</Card>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>
