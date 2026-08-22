<script lang="ts">
	import { resolve } from '$app/paths';
	import { Card } from '@tabeladev/tabelawebui';
	import { formatCurrency } from '$lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const total = $derived(data.tags.reduce((sum, t) => sum + t.expense + t.income, 0));
	const totalExpense = $derived(data.tags.reduce((sum, t) => sum + t.expense, 0));
	const totalIncome = $derived(data.tags.reduce((sum, t) => sum + t.income, 0));
</script>

<svelte:head>
	<title>Tags: TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header>
		<h1 class="font-mono text-2xl font-bold">Tags</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span> Agrupam gastos pontuais sem criar categoria ("Viagem SP",
			"PC novo"). A tag é além da categoria, não no lugar dela.
		</p>
	</header>

	<!-- Management entry points, side by side — same shape as /categories. -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<a href={resolve('/tags/manage')} class="block">
			<Card>
				<Card.Content>
					<div class="flex items-center justify-between">
						<div>
							<h2 class="font-mono text-sm font-semibold">Tags</h2>
							<p class="mt-1 font-mono text-xs text-ink-soft">
								Crie, renomeie ou exclua suas tags.
							</p>
						</div>
						<span class="font-mono text-sm text-accent">→</span>
					</div>
				</Card.Content>
			</Card>
		</a>
		<a href={resolve('/tags/rules')} class="block">
			<Card>
				<Card.Content>
					<div class="flex items-center justify-between">
						<div>
							<h2 class="font-mono text-sm font-semibold">Regras automáticas</h2>
							<p class="mt-1 font-mono text-xs text-ink-soft">
								Marque transações com tags automaticamente pela descrição.
							</p>
						</div>
						<span class="font-mono text-sm text-accent">→</span>
					</div>
				</Card.Content>
			</Card>
		</a>
	</div>

	<!-- Summary -->
	<Card>
		<Card.Content>
			<div class="flex flex-wrap gap-6">
				<div class="flex flex-col gap-1">
					<span class="font-mono text-xs text-ink-faint">Total marcado</span>
					<span class="font-mono text-sm">{formatCurrency(total)}</span>
				</div>
				<div class="flex flex-col gap-1">
					<span class="font-mono text-xs text-ink-faint">Gastos</span>
					<span class="font-mono text-sm text-ctp-red">{formatCurrency(totalExpense)}</span>
				</div>
				<div class="flex flex-col gap-1">
					<span class="font-mono text-xs text-ink-faint">Receitas</span>
					<span class="font-mono text-sm text-ctp-green">{formatCurrency(totalIncome)}</span>
				</div>
			</div>
		</Card.Content>
	</Card>

	<!-- Tag list (read-only here; editing lives in /tags/manage) -->
	<Card>
		<Card.Content>
			<div class="flex flex-col gap-2">
				<h2 class="font-mono text-sm font-semibold">Suas tags</h2>

				{#if data.tags.length === 0}
					<p class="font-mono text-sm text-ink-soft">
						Nenhuma tag ainda. Crie uma em <a
							href={resolve('/tags/manage')}
							class="text-accent hover:underline">gerenciar tags</a
						>, ou marque transações com tags no lançamento/edição.
					</p>
				{/if}

				{#each data.tags as tag (tag.tagId)}
					<div
						class="flex items-center justify-between gap-3 border-b border-rule py-2 last:border-b-0"
					>
						<div class="flex min-w-0 flex-col gap-1">
							<a
								href={resolve(`/transactions?tag=${encodeURIComponent(tag.name)}`)}
								class="truncate font-mono text-sm text-ink hover:text-accent hover:underline"
								>{tag.name}</a
							>
							<span class="font-mono text-xs text-ink-faint">
								{tag.count} transação{tag.count === 1 ? '' : 'ões'} · gastos
								<span class="text-ctp-red">{formatCurrency(tag.expense)}</span>
								· receitas
								<span class="text-ctp-green">{formatCurrency(tag.income)}</span>
							</span>
						</div>
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card>
</div>
