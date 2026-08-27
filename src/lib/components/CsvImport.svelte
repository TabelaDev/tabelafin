<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button, Input, toast } from '@tabeladev/tabelawebui';

	let { onImported }: { onImported?: () => void } = $props();

	let files = $state<FileList | undefined>();
	let uploading = $state(false);

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const file = files?.[0];
		if (!file) {
			toast.info('Escolha um CSV primeiro.');
			return;
		}
		if (!file.name.toLowerCase().endsWith('.csv')) {
			toast.error('O arquivo precisa ser um CSV.');
			return;
		}

		uploading = true;
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetch('/api/statements/extract', { method: 'POST', body: formData });
			const body = (await res.json().catch(() => null)) as {
				reviewId?: string;
				count?: number;
				message?: string;
			} | null;
			if (!res.ok) throw new Error(body?.message ?? 'Falha ao processar o CSV.');

			if (body?.count === 0) {
				toast.info(`Nenhuma transação encontrada em ${file.name}.`);
			} else {
				toast.success(`${body?.count} transação(ões) encontrada(s) em ${file.name}.`);
				onImported?.();
				goto(resolve(`/statements/review?id=${body?.reviewId}`));
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Falha ao processar o CSV.');
		} finally {
			uploading = false;
		}
	}
</script>

<form onsubmit={onSubmit} class="flex flex-col gap-3">
	<Input type="file" accept=".csv" bind:files />
	<p class="text-xs text-ink-soft">
		Formato Nubank: Data,Valor,Identificador,Descrição. Outros bancos em breve.
	</p>
	<Button type="submit" disabled={uploading}>
		{uploading ? 'Processando…' : 'Importar CSV'}
	</Button>
</form>
