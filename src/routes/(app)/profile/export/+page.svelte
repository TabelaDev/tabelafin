<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button, Card, List, ListItem, Page, Select, toast } from '@tabeladev/tabelawebui';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Format = 'json' | 'csv' | 'xlsx';

	let selectedTables = $state<Record<string, boolean>>({
		transactions: true,
		accounts: true,
		categories: true,
		rules: true,
		tags: true,
		tagRules: true,
		recurring: true,
		reports: true,
		uploads: true,
		chat: true,
		prompts: true
	});
	let format = $state<Format>('json');
	let exporting = $state(false);

	const tables = $derived([
		{ key: 'transactions', label: 'Transações', count: data.counts?.transactions ?? 0 },
		{ key: 'accounts', label: 'Contas', count: data.counts?.accounts ?? 0 },
		{ key: 'categories', label: 'Categorias', count: data.counts?.categories ?? 0 },
		{ key: 'rules', label: 'Regras de categorização', count: data.counts?.rules ?? 0 },
		{ key: 'tags', label: 'Tags', count: data.counts?.tags ?? 0 },
		{ key: 'tagRules', label: 'Regras de tags', count: data.counts?.tagRules ?? 0 },
		{ key: 'recurring', label: 'Recorrências', count: data.counts?.recurring ?? 0 },
		{ key: 'reports', label: 'Relatórios mensais', count: data.counts?.reports ?? 0 },
		{ key: 'uploads', label: 'Extratos importados', count: data.counts?.uploads ?? 0 },
		{ key: 'chat', label: 'Conversas com IA', count: data.counts?.chat ?? 0 },
		{ key: 'prompts', label: 'Prompts de IA', count: data.counts?.prompts ?? 0 }
	]);

	const selectedCount = $derived(
		tables.filter((t) => selectedTables[t.key]).reduce((sum, t) => sum + t.count, 0)
	);

	const allSelected = $derived(tables.every((t) => selectedTables[t.key]));
	const noneSelected = $derived(tables.every((t) => !selectedTables[t.key]));

	function toggleAll() {
		const value = !allSelected;
		for (const t of tables) {
			selectedTables[t.key] = value;
		}
	}

	const formatOptions = [
		{ value: 'json', label: 'JSON (todos os dados selecionados)' },
		{ value: 'csv', label: 'CSV (somente transações)' },
		{ value: 'xlsx', label: 'Excel (somente transações, estilizado)' }
	];

	async function exportData() {
		const selected = tables.filter((t) => selectedTables[t.key]).map((t) => t.key);
		if (selected.length === 0) {
			toast.error('Selecione pelo menos uma tabela.');
			return;
		}

		if ((format === 'csv' || format === 'xlsx') && !selectedTables.transactions) {
			toast.error('CSV e Excel só suportam exportação de transações.');
			return;
		}

		exporting = true;
		try {
			const res = await fetch('/api/export', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ format, tables: selected })
			});

			if (!res.ok) {
				const err = (await res.json().catch(() => null)) as { error?: string } | null;
				toast.error(err?.error ?? 'Falha ao exportar.');
				return;
			}

			const blob = await res.blob();
			const disposition = res.headers.get('content-disposition') ?? '';
			const filenameMatch = disposition.match(/filename="(.+)"/);
			const filename =
				filenameMatch?.[1] ??
				`tabelafin-export.${format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'csv' : 'json'}`;

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);

			toast.success('Exportação concluída.');
		} catch {
			toast.error('Falha ao exportar.');
		} finally {
			exporting = false;
		}
	}
</script>

<Page.Shell>
	<Page.Header
		title="Exportar dados"
		subtitle="Escolha o que exportar e o formato."
		back={{ label: 'Perfil', href: resolve('/profile') }}
	/>

	<!-- Format -->
	<Card>
		<Card.Header>
			<Card.Title>Formato</Card.Title>
		</Card.Header>
		<Card.Content>
			<Select id="export-format" bind:value={format} options={formatOptions} />
			{#if format === 'csv' || format === 'xlsx'}
				<p class="mt-2 font-mono text-xs text-ink-faint">
					CSV e Excel exportam somente transações. Para outros dados, use JSON.
				</p>
			{/if}
		</Card.Content>
	</Card>

	<!-- Data selection -->
	<Card>
		<Card.Header>
			<div>
				<Card.Title>Dados</Card.Title>
				<Card.Description>
					{selectedCount} registro{selectedCount === 1 ? '' : 's'} selecionado{selectedCount === 1
						? ''
						: 's'}
				</Card.Description>
			</div>
			<Card.Action>
				<Button onclick={exportData} disabled={exporting || noneSelected}>
					{exporting ? 'Exportando…' : 'Baixar exportação'}
				</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<List
				selectAll={{
					label: allSelected ? 'Desmarcar tudo' : 'Selecionar tudo',
					checked: allSelected,
					onchange: toggleAll
				}}
			>
				{#each tables as table (table.key)}
					<ListItem selectable bind:checked={selectedTables[table.key]}>
						{#snippet content()}{table.label}{/snippet}
						{#snippet end()}
							{table.count} registro{table.count === 1 ? '' : 's'}
						{/snippet}
					</ListItem>
				{/each}
			</List>
		</Card.Content>
	</Card>
</Page.Shell>
