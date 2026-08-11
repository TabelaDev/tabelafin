<script lang="ts">
	import { Dialog, Stepper, Button, Input, Label, Select } from '@tabeladev/tabelawebui';
	import { invalidateAll } from '$app/navigation';
	import { AI_PROVIDERS, type AiProvider } from '$lib/ai-providers';
	import { onboarding, closeOnboarding } from '$lib/onboarding-store';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	const ITEMS = [
		{ value: 'ai', label: 'IA' },
		{ value: 'pluggy', label: 'Open Finance' }
	];

	let { autoOpen = false }: { autoOpen?: boolean } = $props();

	let open = $state(false);
	let step = $state<'ai' | 'pluggy'>('ai');
	let submitting = $state(false);
	let error = $state('');

	// AI form
	let provider = $state<AiProvider>('deepseek');
	let model = $state<string>(AI_PROVIDERS.deepseek.models[0].id);
	let apiKey = $state('');

	// Pluggy form
	let token = $state('');
	let showHelp = $state(false);

	// Steps are disabled while submitting so the user cannot change step with a
	// request in flight.
	const stepperItems = $derived(ITEMS.map((item) => ({ ...item, disabled: submitting })));

	$effect(() => {
		const models = AI_PROVIDERS[provider].models;
		if (!models.some((m) => m.id === model)) model = models[0].id;
	});

	// Kept in step with the store (profile opening the modal on a specific step).
	$effect(() => {
		const unsubscribe = onboarding.subscribe((s) => {
			open = s.open;
			if (s.open) {
				step = s.step;
				error = '';
				submitting = false;
			}
		});
		return unsubscribe;
	});

	// If the Dialog closed through X/Esc/overlay (bind:open -> false), hand the
	// state back to the store so the two do not disagree ({ open: true } in the
	// store with the modal closed on screen).
	$effect(() => {
		if (!open) {
			const current = get(onboarding);
			if (current.open) closeOnboarding();
		}
	});

	// First visit: opens on its own.
	onMount(() => {
		if (autoOpen) onboarding.set({ open: true, step: 'ai' });
	});

	async function submitAi() {
		if (!apiKey.trim()) {
			error = 'Informe sua API key.';
			return;
		}
		submitting = true;
		error = '';
		try {
			const res = await fetch('/api/onboarding/ai', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ provider, model, apiKey })
			});
			const data = (await res.json()) as { error?: string };
			if (!res.ok || data.error) {
				error = data.error ?? 'Não foi possível salvar. Tente novamente.';
				return;
			}
			step = 'pluggy';
		} finally {
			submitting = false;
		}
	}

	async function submitPluggy() {
		if (!token.trim()) {
			error = 'Cole o token de acesso do Meu Pluggy.';
			return;
		}
		submitting = true;
		error = '';
		try {
			const res = await fetch('/api/onboarding/pluggy', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token })
			});
			const data = (await res.json()) as { error?: string };
			if (!res.ok || data.error) {
				error = data.error ?? 'Não foi possível conectar. Tente novamente.';
				return;
			}
			closeOnboarding();
			await invalidateAll();
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog bind:open title="Configurar TabelaFin">
	<div class="mb-4">
		<Stepper items={stepperItems} bind:value={step} />
	</div>

	{#if error}
		<p class="mb-3 text-sm text-destructive">{error}</p>
	{/if}

	{#if step === 'ai'}
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-2">
				<Label for="provider">Provedor</Label>
				<Select
					id="provider"
					bind:value={provider}
					options={Object.entries(AI_PROVIDERS).map(([key, info]) => ({
						value: key,
						label: info.label
					}))}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="model">Modelo</Label>
				<Select
					id="model"
					bind:value={model}
					options={AI_PROVIDERS[provider].models.map((m) => ({
						value: m.id,
						label: m.supportsDocuments ? m.id : `${m.id} (sem upload de PDF)`
					}))}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="apiKey">API key</Label>
				<Input
					id="apiKey"
					type="password"
					autocomplete="off"
					required
					placeholder="sk-..."
					bind:value={apiKey}
				/>
			</div>

			<Button onclick={submitAi} disabled={submitting}>
				{submitting ? 'Salvando…' : 'Continuar'}
			</Button>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<p class="text-sm text-ink-soft">
				O TabelaFin acessa seus dados bancários pelo Meu Pluggy (grátis, pra uso pessoal). Você
				conecta suas contas lá e cola aqui o token que o Meu Pluggy te dá.
			</p>

			<div class="flex flex-col gap-4 text-sm">
				<div class="flex flex-col gap-1">
					<span>
						<span
							class="mr-2 inline-flex size-6 items-center justify-center border border-accent bg-accent-soft font-mono text-xs font-bold text-accent"
							>1</span
						>
						<span>Conecte suas contas no Meu Pluggy.</span>
					</span>
					<p class="text-sm text-ink-soft">
						Entre em
						<a
							class="text-accent underline underline-offset-4 hover:opacity-80"
							href="https://meu.pluggy.ai/en/overview"
							target="_blank"
							rel="noreferrer">meu.pluggy.ai</a
						>
						e faça login. Se ainda não conectou seu banco, conecte agora — é parecido com entrar no app
						do banco.
					</p>
				</div>

				<div class="flex flex-col gap-1">
					<span>
						<span
							class="mr-2 inline-flex size-6 items-center justify-center border border-accent bg-accent-soft font-mono text-xs font-bold text-accent"
							>2</span
						>
						<span>Pegue o seu token de acesso.</span>
					</span>
					<p class="text-sm text-ink-soft">
						É o "crachá" que comprova que é você. O Meu Pluggy mostra ele nas ferramentas de
						desenvolvedor do navegador — não se assuste com esse nome, é só um botão escondido.
					</p>
					<button
						type="button"
						class="mt-1 cursor-pointer self-start font-mono text-xs text-accent underline underline-offset-4 hover:opacity-80"
						onclick={() => (showHelp = !showHelp)}
						>{showHelp
							? '▲ Ocultar o passo a passo'
							: '▼ Como achar o token (guia passo a passo)'}</button
					>

					{#if showHelp}
						<div class="flex flex-col gap-3 border border-rule bg-paper p-4 text-sm text-ink-soft">
							<div class="flex flex-col gap-1">
								<span class="font-mono font-semibold text-ink">1. Abra o painel do navegador</span>
								<p>
									No seu navegador (Chrome, Edge, Brave), aperte a tecla
									<kbd class="border border-rule bg-paper-raised px-1 font-mono">F12</kbd>. Vai
									abrir uma janela nova ao lado da página.
								</p>
							</div>
							<div class="flex flex-col gap-1">
								<span class="font-mono font-semibold text-ink">2. Vá na aba "Rede"</span>
								<p>
									No topo dessa janela, clique na aba <strong>Rede</strong> (ou
									<strong>Network</strong>).
								</p>
							</div>
							<div class="flex flex-col gap-1">
								<span class="font-mono font-semibold text-ink">3. Recarregue a página</span>
								<p>
									Recarregue o Meu Pluggy (aperte <kbd
										class="border border-rule bg-paper-raised px-1 font-mono">F5</kbd
									>). Vão aparecer várias linhas na lista.
								</p>
							</div>
							<div class="flex flex-col gap-1">
								<span class="font-mono font-semibold text-ink">4. Ache a linha do token</span>
								<p>
									Na listinha, cada linha tem uma coluna <strong>Nome</strong> (no começo da linha).
									Os nomes são curtos, tipo
									<code class="border border-rule bg-paper-raised px-1 font-mono">transactions</code
									>,
									<code class="border border-rule bg-paper-raised px-1 font-mono">accounts</code>
									ou
									<code class="border border-rule bg-paper-raised px-1 font-mono">items</code>.
									Clique em qualquer uma delas — as colunas de status, tipo, etc. são só informações
									técnicas, ignore.
								</p>
							</div>
							<div class="flex flex-col gap-1">
								<span class="font-mono font-semibold text-ink">5. Copie o token</span>
								<p>
									Na janelinha que abrir à direita, clique na aba
									<strong>Cabeçalhos</strong> (ou <strong>Headers</strong>). Desça até achar
									"Authorization". O texto ao lado é o seu token — copie tudo, começando em
									<code class="border border-rule bg-paper-raised px-1 font-mono">eyJ</code>.
								</p>
							</div>
							<p class="border-t border-rule pt-3">
								Se aparecer "Bearer" na frente (ex.: <em>Bearer eyJ...abc</em>), copie só a parte de
								depois do espaço. Aí é só colar aqui embaixo.
							</p>
						</div>
					{/if}
				</div>

				<div class="flex flex-col gap-1">
					<span>
						<span
							class="mr-2 inline-flex size-6 items-center justify-center border border-accent bg-accent-soft font-mono text-xs font-bold text-accent"
							>3</span
						>
						<span>Cole o token aqui embaixo.</span>
					</span>
					<p class="text-sm text-ink-soft">
						Pronto! Depois de salvar, suas contas começam a sincronizar sozinhas.
					</p>
				</div>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="token">Token de acesso</Label>
				<Input
					id="token"
					type="password"
					autocomplete="off"
					required
					placeholder="eyJhbGciOi..."
					bind:value={token}
				/>
				<p class="text-sm text-ink-faint">
					Começa com eyJ e pode ser comprido — pode colar inteiro.
				</p>
			</div>

			<Button onclick={submitPluggy} disabled={submitting}>
				{submitting ? 'Validando…' : 'Salvar e conectar'}
			</Button>
		</div>
	{/if}
</Dialog>
