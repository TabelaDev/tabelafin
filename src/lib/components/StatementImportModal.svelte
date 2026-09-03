<script lang="ts">
	// Bulk import of bank statements out of a Google Takeout export.
	//
	// The zip is parsed here in the browser and only the extracted PDFs are sent
	// on, one per request, to /api/statement-upload — the endpoint that already
	// handles a single statement, with its own model-capability gate and audit
	// row. The .mbox holds the full text of every matched email, and none of that
	// needs to reach the server.
	//
	// The queue is sequential on purpose: each request is an AI document
	// extraction that takes tens of seconds, and running them in parallel just
	// invites the provider's rate limit.
	import {
		type TakeoutAttachment,
		TakeoutParseError,
		extractPdfsFromTakeout
	} from '$lib/client/takeout-mbox';
	import {
		type ImportState,
		type QueueItem,
		closeStatementImport,
		finishQueue,
		initialImportState,
		markItem,
		resetStatementImport,
		setAllSelected,
		setAttachments,
		setCurrentIndex,
		setStep,
		startQueue,
		statementImport,
		toggleSelected
	} from '$lib/stores/statement-import-store';

	import { invalidateAll } from '$app/navigation';
	import { Button, Checkbox, Dialog, Input, Stepper, toast } from '@tabelhadev/tabelhawebui';

	const STEPS = [
		{ value: 'instructions', label: 'Takeout' },
		{ value: 'upload', label: 'Arquivo' },
		{ value: 'review', label: 'Revisar' }
	];

	// Named `importState`, never `state`: Svelte reads `$state` as the value of a
	// store called `state`, so a local by that name breaks the rune outright.
	let importState = $state<ImportState>({ ...initialImportState });
	let open = $state(false);
	let parsing = $state(false);
	let parseError = $state('');
	let files = $state<FileList | undefined>();

	$effect(() => {
		const unsubscribe = statementImport.subscribe((s) => {
			importState = s;
			open = s.open;
		});
		return unsubscribe;
	});

	// Dialog closed by X/Esc/overlay — keep the store in step with the screen.
	$effect(() => {
		if (!open && importState.open) closeStatementImport();
	});

	const attachments = $derived(importState.attachments);
	const selectedCount = $derived(importState.selected.size);

	// Roughly 30s per statement, which is what an extraction costs in practice.
	const estimatedMinutes = $derived(Math.max(1, Math.round((selectedCount * 30) / 60)));

	const stepperItems = $derived(
		STEPS.map((s) => ({ ...s, disabled: parsing || importState.running }))
	);

	const doneCount = $derived(
		importState.queue.filter((q: QueueItem) => q.status === 'done').length
	);
	const failedCount = $derived(
		importState.queue.filter((q: QueueItem) => q.status === 'failed').length
	);

	function monthLabel(key: string): string {
		const [y, m] = key.split('-').map(Number);
		const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
			month: 'long',
			year: 'numeric'
		});
		return label.charAt(0).toUpperCase() + label.slice(1);
	}

	// Already-imported filenames, so the review list can untick what went through
	// on an earlier run. A failure here is not fatal: worst case nothing comes
	// back pre-unticked and the dedupe still keeps the data honest.
	async function fetchCompletedFilenames(): Promise<Set<string>> {
		try {
			const res = await fetch('/api/statement-upload');
			if (!res.ok) return new Set();
			const body = (await res.json()) as { completed?: string[] };
			return new Set(body.completed ?? []);
		} catch {
			return new Set();
		}
	}

	async function onZipChosen() {
		const file = files?.[0];
		if (!file) return;
		parsing = true;
		parseError = '';
		try {
			const [found, completed] = await Promise.all([
				extractPdfsFromTakeout(await file.arrayBuffer()),
				fetchCompletedFilenames()
			]);

			if (found.length === 0) {
				parseError =
					'Nenhum PDF encontrado no export. Confira se o label filtrado no Takeout é o dos extratos.';
				return;
			}
			setAttachments(found, completed);
		} catch (err) {
			parseError =
				err instanceof TakeoutParseError
					? err.message
					: 'Não foi possível ler o arquivo. Ele precisa ser o .zip que o Takeout gerou.';
		} finally {
			parsing = false;
		}
	}

	async function runQueue() {
		const chosen = attachments.filter((a: TakeoutAttachment) =>
			importState.selected.has(a.filename)
		);
		if (chosen.length === 0) return;

		const items: QueueItem[] = chosen.map((a: TakeoutAttachment) => ({
			filename: a.filename,
			monthKey: a.monthKey,
			status: 'pending',
			imported: 0,
			duplicates: 0
		}));
		startQueue(items);
		closeStatementImport();

		for (const [index, attachment] of chosen.entries()) {
			setCurrentIndex(index);
			markItem(index, { status: 'uploading' });
			try {
				const body = new FormData();
				body.append(
					'file',
					new File([attachment.bytes as BlobPart], attachment.filename, {
						type: 'application/pdf'
					})
				);
				const res = await fetch('/api/statement-upload', { method: 'POST', body });
				const payload = (await res.json().catch(() => null)) as {
					count?: number;
					duplicates?: number;
					message?: string;
				} | null;
				if (!res.ok) throw new Error(payload?.message ?? 'Falha ao processar o PDF.');
				markItem(index, {
					status: 'done',
					imported: payload?.count ?? 0,
					duplicates: payload?.duplicates ?? 0
				});
			} catch (err) {
				// One bad statement does not stop the other 28.
				markItem(index, {
					status: 'failed',
					error: err instanceof Error ? err.message : 'Falha ao processar o PDF.'
				});
			}
		}

		finishQueue();

		const imported = $statementImport.queue.reduce((sum, q) => sum + q.imported, 0);
		const failed = $statementImport.queue.filter((q) => q.status === 'failed').length;
		if (failed > 0) {
			toast.warning(
				`${imported} transação(ões) importada(s), ${failed} extrato(s) falharam: reabra a importação pra ver quais.`
			);
		} else {
			toast.success(`${imported} transação(ões) importada(s) de ${chosen.length} extrato(s).`, {
				action: { label: 'Ver transações', onClick: () => (window.location.href = '/transactions') }
			});
		}
		await invalidateAll();
	}

	// Leaving mid-queue abandons the remaining uploads, so say so.
	$effect(() => {
		if (!importState.running) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});
</script>

<Dialog bind:open title="Importar extratos do Gmail">
	<div class="flex flex-col gap-4">
		<Stepper items={stepperItems} value={importState.step} />

		{#if importState.step === 'instructions'}
			<div class="flex flex-col gap-3 font-mono text-sm text-ink-soft">
				<p>
					Os extratos chegam um por email, então a forma de tirar todos de uma vez é exportar o
					Gmail. Não precisa de senha de app nem de conectar nada.
				</p>
				<ol class="flex list-decimal flex-col gap-2 pl-5">
					<li>
						No Gmail, busque <span class="text-ink">from:nubank filename:pdf</span>, selecione todas
						as conversas e aplique um label novo (ex.: <span class="text-ink">Extratos</span>).
					</li>
					<li>
						Acesse <span class="text-ink">takeout.google.com</span>, clique em "desmarcar tudo" e
						marque só <span class="text-ink">Mail</span>.
					</li>
					<li>
						Dentro de Mail, escolha "incluir todas as mensagens" → e selecione apenas o label que
						você criou.
					</li>
					<li>Exporte como <span class="text-ink">.zip</span> com link de download.</li>
				</ol>
				<p class="text-ink-faint">
					O Google leva de alguns minutos a algumas horas pra gerar o arquivo: ele avisa por email
					quando estiver pronto.
				</p>
			</div>
		{:else if importState.step === 'upload'}
			<div class="flex flex-col gap-3">
				<Input type="file" accept=".zip,application/zip" bind:files onchange={onZipChosen} />
				<p class="font-mono text-xs text-ink-soft">
					O zip é lido aqui no navegador: só os PDFs dos extratos são enviados, um por vez. O
					conteúdo dos emails não sai da sua máquina.
				</p>
				{#if parsing}
					<p class="font-mono text-sm text-accent">Lendo o export…</p>
				{/if}
				{#if parseError}
					<p class="font-mono text-sm text-danger">{parseError}</p>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-3">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="font-mono text-sm">
						{attachments.length} extrato(s) encontrado(s) · {selectedCount} marcado(s)
					</p>
					<div class="flex items-center gap-2">
						<Button
							size="sm"
							variant="ghost"
							onclick={() =>
								setAllSelected(
									attachments.map((a: TakeoutAttachment) => a.filename),
									true
								)}
						>
							Marcar todos
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onclick={() =>
								setAllSelected(
									attachments.map((a: TakeoutAttachment) => a.filename),
									false
								)}
						>
							Desmarcar
						</Button>
					</div>
				</div>

				<div class="max-h-64 overflow-y-auto border border-rule">
					{#each attachments as attachment (attachment.filename)}
						{@const already = importState.alreadyImported.has(attachment.filename)}
						<label
							class="flex items-center justify-between gap-3 border-b border-rule px-3 py-2 last:border-b-0"
						>
							<span class="flex items-center gap-2">
								<Checkbox
									checked={importState.selected.has(attachment.filename)}
									onchange={() => toggleSelected(attachment.filename)}
								/>
								<span class="font-mono text-sm">{monthLabel(attachment.monthKey)}</span>
							</span>
							<span class="font-mono text-xs text-ink-faint">
								{already ? 'já importado' : attachment.filename}
							</span>
						</label>
					{/each}
				</div>

				{#if importState.alreadyImported.size > 0}
					<p class="font-mono text-xs text-ink-faint">
						Extratos já importados vêm desmarcados: reimportar gastaria uma chamada de IA pra
						produzir linhas que já existem.
					</p>
				{/if}

				<p class="font-mono text-xs text-ink-soft">
					Cada extrato é lido pelo seu modelo de IA (BYOK): são {selectedCount} chamadas, algo em torno
					de {estimatedMinutes} min no total. Pode fechar esta janela: o progresso continua e aparece
					no canto da tela.
				</p>
			</div>
		{/if}
	</div>

	{#snippet footerStart()}
		{#if importState.step === 'instructions'}
			<Button variant="ghost" onclick={resetStatementImport}>Cancelar</Button>
		{:else if importState.step === 'upload'}
			<Button variant="ghost" onclick={() => setStep('instructions')}>Voltar</Button>
		{:else}
			<Button variant="ghost" onclick={() => setStep('upload')}>Trocar arquivo</Button>
		{/if}
	{/snippet}
	{#snippet footerEnd()}
		{#if importState.step === 'instructions'}
			<Button variant="primary" onclick={() => setStep('upload')}>Já tenho o zip</Button>
		{:else if importState.step === 'review'}
			<Button
				variant="primary"
				disabled={selectedCount === 0 || importState.running}
				onclick={runQueue}
			>
				Importar {selectedCount} extrato(s)
			</Button>
		{/if}
	{/snippet}
</Dialog>

{#if importState.queue.length > 0 && !importState.open}
	<!-- Progress lives outside the modal so closing it does not lose the queue.
	     Offsets are explicit because the chat pill and the status pill already
	     occupy the bottom corners. -->
	<div
		class="fixed bottom-32 left-1/2 z-40 -translate-x-1/2 border border-accent bg-paper-raised px-4 py-2 lg:right-6 lg:bottom-6 lg:left-auto lg:translate-x-0"
	>
		<button
			type="button"
			class="flex items-center gap-3"
			onclick={() => statementImport.update((s) => ({ ...s, open: true }))}
		>
			{#if importState.running}
				<span class="font-mono text-xs text-accent">
					Importando extratos… {doneCount + failedCount}/{importState.queue.length}
				</span>
			{:else}
				<span class="font-mono text-xs">
					{doneCount} importado(s){failedCount > 0 ? `, ${failedCount} com erro` : ''}
				</span>
			{/if}
			{#if !importState.running}
				<span class="font-mono text-xs text-ink-faint">(ver)</span>
			{/if}
		</button>
	</div>
{/if}
