<script lang="ts">
	import CsvImport from '$lib/components/CsvImport.svelte';
	import StatementUpload from '$lib/components/StatementUpload.svelte';
	import { openStatementImport } from '$lib/stores/statement-import-store';
	import type { AiProvider } from '$lib/utils/ai-providers';

	import { Button, Dialog, Tabs } from '@tabelhadev/tabelhawebui';

	let {
		open = $bindable(),
		importTab = $bindable(),
		aiConfigured,
		aiProvider,
		aiModel
	}: {
		open: boolean;
		importTab: string;
		aiConfigured: boolean;
		aiProvider: string | null;
		aiModel: string | null;
	} = $props();
</script>

<Dialog bind:open title="Importar extratos">
	<Tabs
		items={[
			{ value: 'takeout', label: 'Gmail Takeout' },
			{ value: 'pdf', label: 'PDF avulso' },
			{ value: 'csv', label: 'CSV' }
		]}
		bind:value={importTab}
	/>
	{#if importTab === 'takeout'}
		<div>
			<p class="mb-3 font-mono text-xs text-ink-soft">
				Exporte seus emails do Gmail com o filtro do banco. Cada extrato PDF/CSV/OFX é extraído
				automaticamente.
			</p>
			<Button
				onclick={() => {
					open = false;
					openStatementImport();
				}}>Importar Takeout</Button
			>
		</div>
	{:else if importTab === 'pdf'}
		<div>
			{#if aiConfigured && aiProvider && aiModel}
				<StatementUpload provider={aiProvider as AiProvider} model={aiModel} />
			{:else}
				<p class="font-mono text-xs text-ink-soft">
					Configure uma chave de IA em Perfil → IA antes de importar PDFs.
				</p>
			{/if}
		</div>
	{:else if importTab === 'csv'}
		<CsvImport onImported={() => (open = false)} />
	{/if}
</Dialog>
