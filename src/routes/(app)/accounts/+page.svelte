<script lang="ts">
	import { AccountType } from '$lib/enums/account-type';
	import { signedBalance } from '$lib/utils/accounts';
	import { formatCompactCurrency, formatCurrency } from '$lib/utils/format';
	import { handleAction } from '$lib/utils/forms';

	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		Accordion,
		Badge,
		Button,
		Card,
		Input,
		Label,
		Page,
		Select,
		StatTile,
		Table
	} from '@tabelhadev/tabelhawebui';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showForm = $state(false);
	const manualAccounts = $derived(data.accounts.filter((a) => a.manual));

	const typeLabel: Record<string, string> = {
		[AccountType.Checking]: 'Conta corrente',
		[AccountType.CreditCard]: 'Cartão de crédito',
		[AccountType.Investment]: 'Investimentos'
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
		{ value: AccountType.Checking, label: 'Conta corrente' },
		{ value: AccountType.CreditCard, label: 'Cartão de crédito' },
		{ value: AccountType.Investment, label: 'Investimentos' }
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

	const investmentCount = $derived(
		data.accounts.filter((a) => a.type === AccountType.Investment).length
	);
</script>

<svelte:head>
	<title>Contas: TabelaFin</title>
</svelte:head>

{#snippet investmentExplainer()}
	<p class="font-mono text-xs text-ink-soft">
		Produtos de investimento conectados via Open Finance (CDB, Tesouro Direto, fundos, ações)
		aparecem como contas individuais: {investmentCount} das {data.accounts.length} contas aqui são ativos
		separados da mesma corretora. Use o filtro de tipo pra ver só conta corrente e cartão.
	</p>
{/snippet}

<Page.Shell>
	<Page.Header
		title="Contas"
		subtitle="{data.accounts.length} {data.accounts.length === 1 ? 'conta' : 'contas'}"
	>
		{#snippet action()}
			<Button
				onclick={() => (showForm = !showForm)}
				variant={showForm ? 'outline' : 'primary'}
				size="sm"
			>
				{showForm ? 'Cancelar' : '+ Conta manual'}
			</Button>
		{/snippet}
	</Page.Header>

	<!-- Summary cards -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Saldo total" value={formatCompactCurrency(data.summary.total)} />
		<StatTile label="Conta corrente" value={formatCompactCurrency(data.summary.checking)} />
		<StatTile label="Investimentos" value={formatCompactCurrency(data.summary.investment)} />
		<StatTile
			label="Cartão de crédito"
			value={data.summary.credit > 0
				? `-${formatCompactCurrency(data.summary.credit)}`
				: formatCompactCurrency(data.summary.credit)}
			valueClass={data.summary.credit > 0 ? 'text-ctp-red' : ''}
		>
			{#snippet footer()}
				<span>fatura em aberto (dívida)</span>
			{/snippet}
		</StatTile>
	</div>

	<!-- Why the list is so long: every Open Finance investment product becomes
	     its own account. -->
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

	<!-- Filters -->
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
				{rows.length === 1 ? 'conta' : 'contas'} · {formatCurrency(filteredTotal)}
			</p>
		{/if}
		<a href={resolve('/accounts')} class="ml-auto">
			<Button variant="ghost">Limpar</Button>
		</a>
	</div>

	<!-- Accounts table -->
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
			labels={{
				empty:
					data.accounts.length === 0
						? 'Nenhuma conta ainda. Conecte via Open Finance ou crie uma conta manual.'
						: 'Nenhuma conta encontrada para os filtros.'
			}}
		>
			{#snippet cell(row: Record<string, unknown>, key: string)}
				{#if key === 'name'}
					<span class="font-medium">{row.name}</span>
				{:else if key === 'type'}
					<Badge variant="secondary">[{row.type}]</Badge>
				{:else if key === 'balance'}
					<span class={amountClass(Number(row.balance))}>
						{formatCurrency(Number(row.balance))}
					</span>
				{:else}
					<span class="text-xs text-ink-soft">{row.institution}</span>
				{/if}
			{/snippet}
		</Table>
	</div>

	<!-- Manual accounts. Without these the app could not hold a balance at all
	     without Open Finance, so "funciona sem conectar nada" was false: every
	     total reads from finance_accounts, which only the sync ever wrote. -->
	{#if showForm}
		<Card>
			<Card.Header>
				<Card.Title>Nova conta manual</Card.Title>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/create"
					use:enhance={handleAction({ onSuccess: () => (showForm = false) })}
					class="flex flex-col gap-3"
				>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<div class="flex flex-col gap-1">
							<Label for="name">Nome</Label>
							<Input id="name" name="name" placeholder="Ex: Carteira, Banco X" required />
						</div>
						<div class="flex flex-col gap-1">
							<Label for="type">Tipo</Label>
							<Select
								id="type"
								name="type"
								options={[
									{ value: AccountType.Checking, label: 'Conta corrente' },
									{ value: AccountType.CreditCard, label: 'Cartão de crédito' },
									{ value: AccountType.Investment, label: 'Investimentos' }
								]}
							/>
						</div>
						<div class="flex flex-col gap-1">
							<Label for="balance">Saldo atual (R$)</Label>
							<Input id="balance" name="balance" placeholder="0,00" required />
						</div>
					</div>

					<p class="font-mono text-xs text-ink-faint">
						Em cartão de crédito, informe o valor da fatura em aberto (positivo).
					</p>

					<div class="flex justify-end gap-2">
						<Button type="button" variant="outline" size="sm" onclick={() => (showForm = false)}>
							Cancelar
						</Button>
						<Button type="submit" size="sm">Adicionar</Button>
					</div>
				</form>
			</Card.Content>
		</Card>
	{/if}

	{#if manualAccounts.length > 0}
		<Card>
			<Card.Header>
				<Card.Title>Contas manuais</Card.Title>
				<Card.Description>
					O saldo destas é o que você informar. Contas do Open Finance são atualizadas pelo sync e
					por isso não aparecem aqui.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-3">
					{#each manualAccounts as account (account.id)}
						<div class="flex flex-wrap items-end gap-2 border-t border-rule pt-3">
							<span class="flex-1 font-mono text-sm">{account.name}</span>
							<form
								method="POST"
								action="?/updateBalance"
								use:enhance={handleAction()}
								class="flex items-end gap-2"
							>
								<input type="hidden" name="accountId" value={account.id} />
								<Input
									name="balance"
									value={String(account.cachedBalance).replace('.', ',')}
									class="w-32"
									aria-label="Saldo de {account.name}"
								/>
								<Button type="submit" variant="outline" size="sm">Salvar</Button>
							</form>
							<form method="POST" action="?/delete" use:enhance={handleAction()}>
								<input type="hidden" name="accountId" value={account.id} />
								<Button
									type="submit"
									variant="ghost"
									size="sm"
									aria-label="Remover conta {account.name}"
								>
									Remover
								</Button>
							</form>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card>
	{/if}
</Page.Shell>
