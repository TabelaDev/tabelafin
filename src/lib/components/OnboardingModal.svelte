<script lang="ts">
	import { Dialog, Stepper, Button, Input, Label, Select } from '@tabeladev/tabelawebui';
	import { invalidateAll } from '$app/navigation';
	import { AI_PROVIDERS, type AiProvider } from '$lib/lib/ai-providers';
	import { onboarding, closeOnboarding } from '$lib/stores/onboarding-store';
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

	// Pluggy — two connection alternatives (see docs/pluggy-integration.md):
	// the extension (automatic) or pasting the token by hand.
	let connectMethod = $state<'extension' | 'manual'>('extension');
	let deviceToken = $state('');
	let pairingLoading = $state(false);
	let checking = $state(false);
	let statusMsg = $state('');
	let showInstall = $state(false);
	let showHelp = $state(false);
	let token = $state('');

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

	async function generatePairing() {
		pairingLoading = true;
		statusMsg = '';
		try {
			const res = await fetch('/api/pluggy/device', { method: 'POST' });
			const data = (await res.json()) as { deviceToken?: string; error?: string };
			if (!res.ok || !data.deviceToken) {
				statusMsg = data.error ?? 'Não foi possível gerar o código.';
				return;
			}
			deviceToken = data.deviceToken;
		} finally {
			pairingLoading = false;
		}
	}

	async function copyDeviceToken() {
		await navigator.clipboard.writeText(deviceToken);
	}

	// Skipping Open Finance ends the onboarding and marks it as seen, without
	// requiring a connection. (On the AI step, "skip" only advances the flow.)
	async function skip() {
		statusMsg = '';
		try {
			const res = await fetch('/api/onboarding/finish', { method: 'POST' });
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				statusMsg = data?.error ?? 'Não foi possível pular agora.';
				return;
			}
			closeOnboarding();
			await invalidateAll();
		} catch {
			statusMsg = 'Não foi possível pular agora.';
		}
	}

	// After opening Meu Pluggy (with the extension paired), the user comes back
	// here and confirms. When the token has arrived, the onboarding closes.
	async function checkStatus() {
		checking = true;
		statusMsg = '';
		try {
			const res = await fetch('/api/pluggy/status');
			const data = (await res.json()) as { configured?: boolean; error?: string };
			if (!res.ok) {
				statusMsg = data.error ?? 'Não foi possível verificar agora.';
				return;
			}
			if (!data.configured) {
				statusMsg =
					'Ainda não chegou nenhum token. Confira se a extensão está vinculada e abra o Meu Pluggy.';
				return;
			}
			closeOnboarding();
			await invalidateAll();
		} finally {
			checking = false;
		}
	}
</script>

<Dialog bind:open title="Configurar TabelaFin" class="!max-w-2xl">
	<div class="mb-4">
		<Stepper items={stepperItems} bind:value={step} />
	</div>

	{#if error}
		<p class="mb-3 text-sm text-danger">{error}</p>
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

			<div class="flex items-center justify-between gap-3">
				<Button variant="ghost" onclick={() => ((step = 'pluggy'), (error = ''))}>Pular</Button>
				<Button onclick={submitAi} disabled={submitting}>
					{submitting ? 'Salvando…' : 'Continuar'}
				</Button>
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<p class="text-sm text-ink-soft">
				O TabelaFin lê seus dados bancários pelo Meu Pluggy. Há duas formas de conectar — escolha a
				que preferir:
			</p>

			<div class="flex flex-col gap-2">
				<div class="flex flex-wrap gap-2">
					<Button
						variant={connectMethod === 'extension' ? 'primary' : 'outline'}
						size="sm"
						onclick={() => (connectMethod = 'extension')}
					>
						Extensão automática
					</Button>
					<Button
						variant={connectMethod === 'manual' ? 'primary' : 'outline'}
						size="sm"
						onclick={() => (connectMethod = 'manual')}
					>
						Token manual
					</Button>
				</div>
				<p class="text-sm text-ink-faint">
					{connectMethod === 'extension'
						? 'Recomendada: instala a extensão uma vez e o token é capturado sozinho.'
						: 'Sem extensão: você copia o token uma vez, mas ele expira em ~24h e você refaz.'}
				</p>
			</div>

			{#if connectMethod === 'extension'}
				<div class="flex flex-col gap-4 text-sm">
					<div class="flex flex-col gap-1">
						<span>
							<span
								class="mr-2 inline-flex size-6 items-center justify-center border border-accent bg-accent-soft font-mono text-xs font-bold text-accent"
								>1</span
							>
							<span>Instale a extensão.</span>
						</span>
						<p class="text-sm text-ink-soft">
							A extensão é uma pasta deste repositório — não é publicada na loja. "Instalar" é
							carregar ela no Chrome como extensão não compactada.
						</p>
						<button
							type="button"
							class="cursor-pointer self-start font-mono text-xs text-accent underline underline-offset-4 hover:opacity-80"
							onclick={() => (showInstall = !showInstall)}
						>
							{showInstall ? '▲ Ocultar o passo a passo' : '▼ Como instalar (passo a passo)'}
						</button>
						{#if showInstall}
							<div
								class="flex flex-col gap-2 border border-rule bg-paper p-4 text-sm text-ink-soft"
							>
								<p>
									<strong>1.</strong> Baixe o código:
									<a
										class="text-accent underline underline-offset-4 hover:opacity-80"
										href="https://github.com/TabelaDev/tabelafin"
										target="_blank"
										rel="noreferrer">github.com/TabelaDev/tabelafin</a
									>
									→ botão verde "Code" → "Download ZIP" → descompacte a pasta.
								</p>
								<p>
									<strong>2.</strong> Dentro do projeto, a extensão é a pasta
									<code class="border border-rule bg-paper-raised px-1 font-mono">extension/</code>.
								</p>
								<p>
									<strong>3.</strong> No Chrome, abra
									<code class="border border-rule bg-paper-raised px-1 font-mono"
										>chrome://extensions</code
									>.
								</p>
								<p><strong>4.</strong> Ative o "Modo desenvolvedor" (canto superior direito).</p>
								<p>
									<strong>5.</strong> Clique em "Carregar sem compactação" e escolha a pasta
									<code class="border border-rule bg-paper-raised px-1 font-mono">extension/</code>.
								</p>
								<p>
									<strong>6.</strong> Pronto — o ícone da extensão aparece na barra do navegador.
								</p>
							</div>
						{/if}
					</div>

					<div class="flex flex-col gap-1">
						<span>
							<span
								class="mr-2 inline-flex size-6 items-center justify-center border border-accent bg-accent-soft font-mono text-xs font-bold text-accent"
								>2</span
							>
							<span>Vincule a extensão.</span>
						</span>
						<p class="text-sm text-ink-soft">
							Gere um código de pareamento e cole no popup da extensão, no campo "Código de
							pareamento".
						</p>
						{#if deviceToken}
							<div class="flex items-center gap-2 border border-accent bg-accent-soft p-3">
								<code class="min-w-0 flex-1 truncate font-mono text-xs text-accent"
									>{deviceToken}</code
								>
								<Button size="sm" variant="outline" onclick={copyDeviceToken}>Copiar</Button>
							</div>
							<p class="text-sm text-ink-faint">Agora cole esse código no popup da extensão.</p>
						{:else}
							<Button
								size="sm"
								variant="outline"
								onclick={generatePairing}
								disabled={pairingLoading}
							>
								{pairingLoading ? 'Gerando…' : 'Gerar código de pareamento'}
							</Button>
						{/if}
					</div>

					<div class="flex flex-col gap-1">
						<span>
							<span
								class="mr-2 inline-flex size-6 items-center justify-center border border-accent bg-accent-soft font-mono text-xs font-bold text-accent"
								>3</span
							>
							<span>Conecte no Meu Pluggy.</span>
						</span>
						<p class="text-sm text-ink-soft">
							Abra
							<a
								class="text-accent underline underline-offset-4 hover:opacity-80"
								href="https://meu.pluggy.ai/en/overview"
								target="_blank"
								rel="noreferrer">meu.pluggy.ai</a
							>
							e faça login — a extensão captura o token e sincroniza sozinha.
						</p>
					</div>
				</div>

				{#if statusMsg}
					<p class="text-sm text-danger">{statusMsg}</p>
				{/if}

				<div class="flex items-center justify-between gap-3">
					<Button
						variant="ghost"
						onclick={skip}
						disabled={checking || pairingLoading || submitting}
					>
						Pular
					</Button>
					<Button onclick={checkStatus} disabled={checking || pairingLoading}>
						{checking ? 'Verificando…' : 'Já conectei — verificar'}
					</Button>
				</div>
			{:else}
				<div class="flex flex-col gap-4 text-sm">
					<p class="text-sm text-ink-soft">
						O token é o "crachá" que comprova que é você. O Meu Pluggy mostra ele nas ferramentas de
						desenvolvedor do navegador — não se assuste com esse nome, é só um botão escondido.
					</p>
					<button
						type="button"
						class="cursor-pointer self-start font-mono text-xs text-accent underline underline-offset-4 hover:opacity-80"
						onclick={() => (showHelp = !showHelp)}
					>
						{showHelp ? '▲ Ocultar o passo a passo' : '▼ Como achar o token (passo a passo)'}
					</button>

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

				<div class="flex flex-col gap-2">
					<Label for="token">Token de acesso do Meu Pluggy</Label>
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

				<div class="flex items-center justify-between gap-3">
					<Button variant="ghost" onclick={skip} disabled={submitting}>Pular</Button>
					<Button onclick={submitPluggy} disabled={submitting}>
						{submitting ? 'Validando…' : 'Salvar e conectar'}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</Dialog>
