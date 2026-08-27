<script lang="ts">
	// Statement/invoice PDF upload as a manual fallback — see ESCOPO.md §2.4.
	// The file goes straight to the user's AI model (document understanding) and
	// is discarded after the extraction. Capability gating: if the chosen model
	// does not support documents the upload is disabled with an explicit message
	// (BYOK — never swap the model out from under the user).
	import { type AiProvider, modelSupportsDocuments } from '$lib/utils/ai-providers';

	import { Button } from '@tabeladev/tabelawebui';
	import { Input } from '@tabeladev/tabelawebui';
	import { toast } from '@tabeladev/tabelawebui';

	let { provider, model }: { provider: AiProvider; model: string } = $props();

	let files = $state<FileList | undefined>();
	let uploading = $state(false);

	const supports = $derived(modelSupportsDocuments(provider, model));

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const file = files?.[0];
		if (!file) {
			toast.info('Escolha um PDF de fatura ou extrato primeiro.');
			return;
		}
		if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
			toast.error('O arquivo precisa ser um PDF.');
			return;
		}

		uploading = true;
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetch('/api/statement-upload', { method: 'POST', body: formData });
			const body = (await res.json().catch(() => null)) as {
				count?: number;
				message?: string;
			} | null;
			if (!res.ok) throw new Error(body?.message ?? 'Falha ao processar o PDF.');

			if (body?.count === 0) {
				toast.info(`Nenhuma transação encontrada em ${file.name}.`);
			} else {
				toast.success(`${body?.count} transação(ões) importada(s) de ${file.name}.`);
			}
			// Reload to list the freshly imported transactions (the extraction happens
			// on the server; the list comes from the page load).
			setTimeout(() => window.location.reload(), 1200);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Falha ao processar o PDF.');
		} finally {
			uploading = false;
		}
	}
</script>

{#if supports}
	<form onsubmit={onSubmit} class="flex flex-col gap-3">
		<Input type="file" accept="application/pdf" bind:files />
		<p class="text-xs text-ink-soft">
			A fatura/extrato é enviada direto pro modelo ({model}) e não fica salva: as transações
			extraídas já entram categorizadas.
		</p>
		<Button type="submit" disabled={uploading}>
			{uploading ? 'Processando…' : 'Importar PDF'}
		</Button>
	</form>
{:else}
	<p class="text-sm text-ink-soft">
		O modelo atual ({model}) não suporta upload de PDF. Escolha um modelo com suporte a documentos
		(Claude ou GPT) em Perfil → Categorização por IA.
	</p>
{/if}
