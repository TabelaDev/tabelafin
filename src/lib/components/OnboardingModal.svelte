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

	// Pluggy — fluxo da extensão (ver docs/pluggy-integration.md)
	let deviceToken = $state('');
	let pairingLoading = $state(false);
	let checking = $state(false);
	let statusMsg = $state('');
	// Fallback avançado: colar o token manualmente.
	let token = $state('');
	let showManual = $state(false);

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

	// Depois de abrir o Meu Pluggy (com a extensão vinculada), o usuário volta
	// aqui e confirma. Se o token já chegou, o onboarding fecha.
	// Pular o Open Finance: encerra o onboarding marcando como visto, sem exigir
	// conexão. (Na etapa de IA, "pular" só avança pra próxima etapa.)
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

	// Depois de abrir o Meu Pluggy (com a extensão vinculada), o usuário volta
	// aqui e confirma. Se o token já chegou, o onboarding fecha.
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

<Dialog bind:open title="Configurar TabelaFin">
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
				O TabelaFin lê seus dados bancários pelo Meu Pluggy com uma extensão de navegador que pega o
				seu token automaticamente. Você só faz login no Meu Pluggy — o resto acontece sozinho.
			</p>

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
						Ela fica na pasta <code class="border border-rule bg-paper-raised px-1 font-mono"
							>extension/</code
						>
						do repositório. Carregue no Chrome em
						<code class="border border-rule bg-paper-raised px-1 font-mono"
							>chrome://extensions</code
						>
						(ative o "Modo desenvolvedor" e escolha "Carregar sem compactação").
					</p>
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
						<Button size="sm" variant="outline" onclick={generatePairing} disabled={pairingLoading}>
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
				<Button variant="ghost" onclick={skip} disabled={checking || pairingLoading || submitting}>
					Pular
				</Button>
				<Button onclick={checkStatus} disabled={checking || pairingLoading}>
					{checking ? 'Verificando…' : 'Já conectei — verificar'}
				</Button>
			</div>

			<button
				type="button"
				class="cursor-pointer self-start font-mono text-xs text-accent underline underline-offset-4 hover:opacity-80"
				onclick={() => (showManual = !showManual)}
			>
				{showManual ? '▲ Ocultar opção manual' : '▼ Prefere colar o token manualmente?'}
			</button>

			{#if showManual}
				<div class="flex flex-col gap-2 border border-rule bg-paper p-4">
					<Label for="token">Token de acesso do Meu Pluggy</Label>
					<Input
						id="token"
						type="password"
						autocomplete="off"
						placeholder="eyJhbGciOi..."
						bind:value={token}
					/>
					<p class="text-sm text-ink-faint">
						Começa com eyJ. O Meu Pluggy mostra ele nas ferramentas de desenvolvedor do navegador
						(F12 → Rede → Cabeçalhos → Authorization).
					</p>
					<Button onclick={submitPluggy} disabled={submitting}>
						{submitting ? 'Validando…' : 'Salvar e conectar'}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</Dialog>
