<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Card } from '@tabeladev/tabelawebui';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let categorizationPrompt = $state('');
	let reportPrompt = $state('');
	let chatSystemPrompt = $state('');
	let categorizationEnabled = $state(true);
	let reportEnabled = $state(true);
	let chatEnabled = $state(true);

	$effect(() => {
		categorizationPrompt = data.prompts.categorizationPrompt ?? '';
		reportPrompt = data.prompts.reportPrompt ?? '';
		chatSystemPrompt = data.prompts.chatSystemPrompt ?? '';
		categorizationEnabled = data.toggles.categorization;
		reportEnabled = data.toggles.report;
		chatEnabled = data.toggles.chat;
	});

	// The default prompts surfaced in the UI (they mirror the hardcoded ones in
	// categorize.ts/report.ts/chat) — shown in a <details> when the field is
	// empty.
	const DEFAULT_CATEGORIZATION_PROMPT = `Você categoriza transações financeiras pessoais (Brasil). Categorias válidas: [categorias do usuário].

Regras:
- Valores negativos costumam ser gastos, positivos costumam ser entrada de dinheiro (ex: "Renda" ou "Transferências").
- Use "Transferências" pra Pix/TED/DOC entre contas do próprio usuário ou pra terceiros sem contexto de compra.
- Use "Investimentos" pra aplicações, resgates e movimentações de corretora.
- Use "Outros" só quando nenhuma categoria específica se aplicar com confiança.`;
</script>

<svelte:head>
	<title>Configuração de IA — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header>
		<div class="flex items-center gap-3">
			<a href={resolve('/profile')} class="font-mono text-sm text-ink-soft hover:text-ink">
				← Perfil
			</a>
		</div>
		<h1 class="mt-2 font-mono text-2xl font-bold">Configuração de IA</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span> Customize como a IA se comporta no app. Deixe vazio pra usar
			o prompt padrão.
		</p>
	</header>

	<form method="POST" use:enhance class="flex flex-col gap-6">
		<!-- Categorização -->
		<Card>
			<Card.Content>
				<div class="flex flex-col gap-3">
					<div class="flex items-start justify-between gap-4">
						<div>
							<h2 class="font-mono text-sm font-semibold">Categorização de transações</h2>
							<p class="mt-1 font-mono text-xs text-ink-soft">
								System prompt usado pra categorizar transações em lote. Define regras e
								comportamento da IA ao classificar gastos.
							</p>
						</div>
						<label class="flex shrink-0 cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								name="categorizationEnabled"
								bind:checked={categorizationEnabled}
								class="h-4 w-4 accent-ctp-green"
							/>
							<span class="font-mono text-xs text-ink-soft">Ativo</span>
						</label>
					</div>
					<textarea
						name="categorizationPrompt"
						bind:value={categorizationPrompt}
						rows="8"
						placeholder="Você categoriza transações financeiras pessoais (Brasil). Categorias válidas: ..."
						class="bg-paper-inset w-full resize-y rounded border border-rule px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
					></textarea>
					<p class="font-mono text-xs text-ink-faint">
						Deixe vazio pra usar o prompt padrão. Suas categorias (definidas em Perfil → Categorias)
						são injetadas automaticamente.
					</p>
					<details class="font-mono text-xs text-ink-soft">
						<summary class="cursor-pointer text-accent hover:underline">Ver prompt padrão</summary>
						<pre
							class="mt-2 border border-rule bg-paper-raised p-3 whitespace-pre-wrap text-ink-soft">{DEFAULT_CATEGORIZATION_PROMPT}</pre>
					</details>
				</div>
			</Card.Content>
		</Card>

		<!-- Relatório mensal -->
		<Card>
			<Card.Content>
				<div class="flex flex-col gap-3">
					<div class="flex items-start justify-between gap-4">
						<div>
							<h2 class="font-mono text-sm font-semibold">Relatório mensal</h2>
							<p class="mt-1 font-mono text-xs text-ink-soft">
								Template do prompt usado pra gerar o resumo mensal. A IA recebe seus dados
								financeiros e segue essas instruções pra escrever o relatório.
							</p>
						</div>
						<label class="flex shrink-0 cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								name="reportEnabled"
								bind:checked={reportEnabled}
								class="h-4 w-4 accent-ctp-green"
							/>
							<span class="font-mono text-xs text-ink-soft">Ativo</span>
						</label>
					</div>
					<textarea
						name="reportPrompt"
						bind:value={reportPrompt}
						rows="8"
						placeholder="Escreva um parágrafo curto (3-5 frases, em português do Brasil, tom direto e prático) ..."
						class="bg-paper-inset w-full resize-y rounded border border-rule px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
					></textarea>
				</div>
			</Card.Content>
		</Card>

		<!-- Chat IA -->
		<Card>
			<Card.Content>
				<div class="flex flex-col gap-3">
					<div class="flex items-start justify-between gap-4">
						<div>
							<h2 class="font-mono text-sm font-semibold">Chat com IA</h2>
							<p class="mt-1 font-mono text-xs text-ink-soft">
								System prompt do chat conversacional. Define a personalidade e comportamento da IA
								quando o usuário faz perguntas sobre seus gastos.
							</p>
						</div>
						<label class="flex shrink-0 cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								name="chatEnabled"
								bind:checked={chatEnabled}
								class="h-4 w-4 accent-ctp-green"
							/>
							<span class="font-mono text-xs text-ink-soft">Ativo</span>
						</label>
					</div>
					<textarea
						name="chatSystemPrompt"
						bind:value={chatSystemPrompt}
						rows="8"
						placeholder="Você é um assistente financeiro pessoal. Responda em português do Brasil, ..."
						class="bg-paper-inset w-full resize-y rounded border border-rule px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
					></textarea>
				</div>
			</Card.Content>
		</Card>

		{#if form?.success}
			<p class="font-mono text-sm text-signal">Configurações salvas com sucesso.</p>
		{/if}

		{#if form?.error}
			<p class="font-mono text-sm text-destructive">{form.error}</p>
		{/if}

		<div class="flex justify-end">
			<Button type="submit">Salvar configurações</Button>
		</div>
	</form>
</div>
