<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge, Button, Card, Page } from '@tabeladev/tabelawebui';

	let { data } = $props();

	const statusMap: Record<
		string,
		{ label: string; variant: 'success' | 'danger' | 'info' | 'warn' }
	> = {
		pending: { label: 'Processando', variant: 'warn' },
		ready: { label: 'Aguardando revisão', variant: 'info' },
		applied: { label: 'Aplicado', variant: 'success' },
		cancelled: { label: 'Cancelado', variant: 'danger' }
	};

	const sourceMap: Record<string, string> = {
		takeout_zip: 'Gmail Takeout',
		single_pdf: 'PDF',
		csv: 'CSV'
	};

	function formatDate(date: Date | string): string {
		const d = new Date(date);
		return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Extratos — tabelafin</title>
</svelte:head>

<Page.Shell>
	<Page.Header title="Extratos importados" />

	{#if data.reviews.length === 0}
		<Card>
			<Card.Content>
				<p class="font-mono text-sm text-ink-soft">
					Nenhum extrato importado ainda. Volte ao perfil para importar seu primeiro extrato.
				</p>
			</Card.Content>
		</Card>
	{:else}
		<div class="space-y-3">
			{#each data.reviews as review (review.id)}
				{@const status = statusMap[review.status] ?? statusMap.pending}
				<Card>
					<Card.Content>
						<div class="flex items-center justify-between gap-4">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<h3 class="truncate font-mono text-sm font-semibold">{review.filename}</h3>
									<Badge variant={status.variant}>{status.label}</Badge>
								</div>
								<div class="mt-1 flex items-center gap-3 font-mono text-xs text-ink-soft">
									<span>{sourceMap[review.source] ?? review.source}</span>
									<span>{formatDate(review.createdAt)}</span>
									{#if review.transactionCount > 0}
										<span>{review.transactionCount} transações</span>
									{/if}
									{#if review.duplicateCount > 0}
										<span>{review.duplicateCount} duplicatas</span>
									{/if}
								</div>
							</div>
							{#if review.status === 'ready'}
								<Button href={resolve('/statements/review') + `?id=${review.id}`} size="sm">
									Revisar
								</Button>
							{/if}
						</div>
					</Card.Content>
				</Card>
			{/each}
		</div>
	{/if}
</Page.Shell>
