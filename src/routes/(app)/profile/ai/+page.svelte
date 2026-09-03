<script lang="ts">
	import {
		DEFAULT_CATEGORIZATION_PROMPT,
		DEFAULT_CHAT_PROMPT,
		DEFAULT_REPORT_INSTRUCTION
	} from '$lib/prompts';
	import { handleAction } from '$lib/utils/forms';

	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Card, Dialog, Page, Textarea, Toggle } from '@tabelhadev/tabelhawebui';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let categorizationPrompt = $state('');
	let reportPrompt = $state('');
	let chatSystemPrompt = $state('');
	let categorizationEnabled = $state(true);
	let reportEnabled = $state(true);
	let chatEnabled = $state(true);

	let showResetDialog = $state(false);
	let resetTarget = $state<'categorization' | 'report' | 'chat'>('categorization');

	$effect(() => {
		categorizationPrompt = data.prompts.categorizationPrompt ?? DEFAULT_CATEGORIZATION_PROMPT;
		reportPrompt = data.prompts.reportPrompt ?? DEFAULT_REPORT_INSTRUCTION;
		chatSystemPrompt = data.prompts.chatSystemPrompt ?? DEFAULT_CHAT_PROMPT;
		categorizationEnabled = data.toggles.categorization;
		reportEnabled = data.toggles.report;
		chatEnabled = data.toggles.chat;
	});

	function confirmReset(target: 'categorization' | 'report' | 'chat') {
		resetTarget = target;
		showResetDialog = true;
	}

	function applyReset() {
		if (resetTarget === 'categorization') {
			categorizationPrompt = DEFAULT_CATEGORIZATION_PROMPT;
		} else if (resetTarget === 'report') {
			reportPrompt = DEFAULT_REPORT_INSTRUCTION;
		} else {
			chatSystemPrompt = DEFAULT_CHAT_PROMPT;
		}
		showResetDialog = false;
	}
</script>

<svelte:head>
	<title>Configuração de IA: TAbelhaFin</title>
</svelte:head>

<Page.Shell>
	<Page.Header
		title="Configuração de IA"
		subtitle="Customize como a IA se comporta no app. Deixe vazio pra usar o prompt padrão."
		back={{ label: 'Perfil', href: resolve('/profile') }}
	/>

	<form method="POST" use:enhance={handleAction()} class="flex flex-col gap-6">
		<!-- Categorisation -->
		<Card>
			<Card.Header>
				<div>
					<Card.Title>Categorização de transações</Card.Title>
					<Card.Description>
						System prompt usado pra categorizar transações em lote. Define regras e comportamento da
						IA ao classificar gastos.
					</Card.Description>
				</div>
				<Card.Action>
					<Toggle name="categorizationEnabled" checked={categorizationEnabled} label="Ativo" />
				</Card.Action>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-3">
					<Textarea
						name="categorizationPrompt"
						bind:value={categorizationPrompt}
						rows={8}
						placeholder="Você categoriza transações financeiras pessoais (Brasil). Categorias válidas: ..."
					/>
					<p class="font-mono text-xs text-ink-faint">
						Deixe vazio pra usar o prompt padrão. Suas categorias (definidas em Perfil → Categorias)
						são injetadas automaticamente.
					</p>
					<div>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onclick={() => confirmReset('categorization')}
						>
							Restaurar padrão
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card>

		<!-- Monthly report -->
		<Card>
			<Card.Header>
				<div>
					<Card.Title>Relatório mensal</Card.Title>
					<Card.Description>
						Template do prompt usado pra gerar o resumo mensal. A IA recebe seus dados financeiros e
						segue essas instruções pra escrever o relatório.
					</Card.Description>
				</div>
				<Card.Action>
					<Toggle name="reportEnabled" checked={reportEnabled} label="Ativo" />
				</Card.Action>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-3">
					<Textarea
						name="reportPrompt"
						bind:value={reportPrompt}
						rows={8}
						placeholder="Escreva um parágrafo curto (3-5 frases, em português do Brasil, tom direto e prático) ..."
					/>
					<div>
						<Button type="button" size="sm" variant="ghost" onclick={() => confirmReset('report')}>
							Restaurar padrão
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card>

		<!-- AI Chat -->
		<Card>
			<Card.Header>
				<div>
					<Card.Title>Chat com IA</Card.Title>
					<Card.Description>
						System prompt do chat conversacional. Define a personalidade e comportamento da IA
						quando o usuário faz perguntas sobre seus gastos.
					</Card.Description>
				</div>
				<Card.Action>
					<Toggle name="chatEnabled" checked={chatEnabled} label="Ativo" />
				</Card.Action>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-3">
					<Textarea
						name="chatSystemPrompt"
						bind:value={chatSystemPrompt}
						rows={8}
						placeholder="Você é um assistente financeiro pessoal. Responda em português do Brasil, ..."
					/>
					<div>
						<Button type="button" size="sm" variant="ghost" onclick={() => confirmReset('chat')}>
							Restaurar padrão
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card>

		<div class="flex justify-end">
			<Button type="submit">Salvar configurações</Button>
		</div>
	</form>
</Page.Shell>

<Dialog bind:open={showResetDialog} title="Restaurar prompt padrão">
	<div class="flex flex-col gap-4">
		<p class="font-mono text-sm text-ink-soft">
			Tem certeza que deseja restaurar o prompt padrão? O texto atual será substituído.
		</p>
		<div class="flex justify-end gap-2">
			<Button type="button" size="sm" onclick={() => (showResetDialog = false)}>Cancelar</Button>
			<Button type="button" size="sm" onclick={applyReset}>Restaurar</Button>
		</div>
	</div>
</Dialog>
