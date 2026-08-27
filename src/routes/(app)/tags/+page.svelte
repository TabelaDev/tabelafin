<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	import { resolve } from '$app/paths';
	import { Card, Page } from '@tabeladev/tabelawebui';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const total = $derived(data.tags.reduce((sum, t) => sum + t.expense + t.income, 0));
	const totalExpense = $derived(data.tags.reduce((sum, t) => sum + t.expense, 0));
	const totalIncome = $derived(data.tags.reduce((sum, t) => sum + t.income, 0));
</script>

<svelte:head>
	<title>Tags: TabelaFin</title>
</svelte:head>

<Page.Shell>
	<Page.Header
		title="Tags"
		subtitle="Agrupam gastos pontuais sem criar categoria ('Viagem SP', 'PC novo'). A tag é além da categoria, não no lugar dela."
	/>

	<!-- Management entry points, side by side — same shape as /categories. -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<a href={resolve('/tags/manage')} class="block">
			<Card>
				<Card.Header>
					<div>
						<Card.Title>Tags</Card.Title>
						<Card.Description>Crie, renomeie ou exclua suas tags.</Card.Description>
					</div>
					<Card.Action navigate />
				</Card.Header>
			</Card>
		</a>
		<a href={resolve('/tags/rules')} class="block">
			<Card>
				<Card.Header>
					<div>
						<Card.Title>Regras automáticas</Card.Title>
						<Card.Description
							>Marque transações com tags automaticamente pela descrição.</Card.Description
						>
					</div>
					<Card.Action navigate />
				</Card.Header>
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
		<Card.Header>
			<Card.Title>Suas tags</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-col gap-2">
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
</Page.Shell>
