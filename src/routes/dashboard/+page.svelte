<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const currencyFormatter = new Intl.NumberFormat('pt-BR', {
		style: 'currency',
		currency: 'BRL'
	});
</script>

<svelte:head>
	<title>Dashboard — TabelaFin</title>
</svelte:head>

<div class="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-6">
	<header class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">TabelaFin</h1>
		<form method="POST" action="/logout">
			<Button type="submit" variant="ghost" size="sm">Sair</Button>
		</form>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Configuração</Card.Title>
			<Card.Description>
				IA: {data.aiProvider} / {data.aiModel} · Open Finance: conectado
			</Card.Description>
		</Card.Header>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Contas</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if data.accounts.length === 0}
				<p class="text-sm text-muted-foreground">
					Nenhuma conta sincronizada ainda — o sync automático via Pluggy ainda está em
					desenvolvimento.
				</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each data.accounts as account (account.id)}
						<li class="flex justify-between text-sm">
							<span>{account.name} ({account.institution})</span>
							<span>{currencyFormatter.format(account.cachedBalance)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Transações recentes</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if data.recentTransactions.length === 0}
				<p class="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each data.recentTransactions as tx (tx.id)}
						<li class="flex justify-between text-sm">
							<span>{tx.description}</span>
							<span>{currencyFormatter.format(tx.amount)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
