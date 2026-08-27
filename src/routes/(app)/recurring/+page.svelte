<script lang="ts">
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import { Frequency } from '$lib/enums/frequency';
	import { getCategoryColor } from '$lib/utils/categories';
	import { formatCompactCurrency, formatDate } from '$lib/utils/format';
	import { handleAction } from '$lib/utils/forms';

	import { enhance } from '$app/forms';
	import { Button, Card, Input, Label, Page, Select } from '@tabeladev/tabelawebui';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showForm = $state(false);
	let description = $state('');
	let amount = $state('');
	let category = $state('');
	let frequency = $state(Frequency.Monthly);
	let nextChargeDate = $state('');

	const FREQUENCIES: { value: string; label: string }[] = [
		{ value: Frequency.Weekly, label: 'Semanal' },
		{ value: Frequency.Monthly, label: 'Mensal' },
		{ value: Frequency.Quarterly, label: 'Trimestral' },
		{ value: Frequency.Yearly, label: 'Anual' }
	];
	const FREQUENCY_LABELS: Record<string, string> = Object.fromEntries(
		FREQUENCIES.map((f) => [f.value, f.label])
	);

	// Display order of the frequencies.
	const GROUP_ORDER = [Frequency.Monthly, Frequency.Weekly, Frequency.Quarterly, Frequency.Yearly];

	// Groups active recurrences by frequency, in the defined order.
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

	// Delegates to $lib/utils/format so the UTC-midnight convention is applied here
	// too — a next-charge date is a calendar day, and rendering it in the
	// browser's zone showed the 1st as the last day of the previous month.
	function formatNullableDate(ts: Date | string | null): string {
		return ts ? formatDate(ts) : '—';
	}

	function resetForm() {
		description = '';
		amount = '';
		category = '';
		frequency = Frequency.Monthly;
		nextChargeDate = '';
		showForm = false;
	}
</script>

<svelte:head>
	<title>Recorrências: TabelaFin</title>
</svelte:head>

<Page.Shell>
	<Page.Header title="Recorrências" subtitle="Assinaturas e despesas fixas.">
		{#snippet action()}
			<Button
				onclick={() => (showForm = !showForm)}
				variant={showForm ? 'outline' : 'primary'}
				size="sm"
			>
				{showForm ? 'Cancelar' : '+ Novo'}
			</Button>
		{/snippet}
	</Page.Header>

	<!-- Estimated monthly total -->
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

	<!-- New recurring expense form -->
	{#if showForm}
		<Card>
			<Card.Header>
				<Card.Title>Nova recorrência</Card.Title>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/create"
					use:enhance={handleAction({ onSuccess: resetForm })}
					class="flex flex-col gap-3"
				>
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

					<div class="flex justify-end">
						<Button type="submit" size="sm">Adicionar</Button>
					</div>
				</form>
			</Card.Content>
		</Card>
	{/if}

	<!-- List grouped by frequency -->
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
												<CategoryBadge
													category={expense.category}
													color={getCategoryColor(data.categories, expense.category)}
												/>
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
											<span>última: {formatNullableDate(expense.lastOccurrence)}</span>
											{#if expense.nextChargeDate}
												<span>·</span>
												<span>próxima: {formatNullableDate(expense.nextChargeDate)}</span>
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-3">
										<span class="font-mono text-sm font-semibold"
											>{formatCompactCurrency(expense.amount)}</span
										>
										<form method="POST" action="?/delete" use:enhance={handleAction()}>
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
</Page.Shell>
