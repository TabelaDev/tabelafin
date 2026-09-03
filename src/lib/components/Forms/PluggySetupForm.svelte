<script lang="ts">
	import ExtensionInstallModal from '$lib/components/ExtensionInstallModal.svelte';

	import { invalidateAll } from '$app/navigation';
	import { Button, Dialog, Input, Instruction, Label, Tabs, toast } from '@tabelhadev/tabelhawebui';

	let {
		onSuccess,
		skippable = false,
		submitting = $bindable(false)
	}: {
		onSuccess?: () => void;
		// Skip hits /api/onboarding/finish to mark the onboarding as seen
		// server-side: only rendered inside the onboarding flow.
		skippable?: boolean;
		submitting?: boolean;
	} = $props();

	let connectMethod = $state<'extension' | 'manual'>('extension');
	let deviceToken = $state('');
	let pairingLoading = $state(false);
	let checking = $state(false);
	let statusMsg = $state('');
	let showInstallModal = $state(false);
	let token = $state('');
	let error = $state('');

	async function generatePairing() {
		pairingLoading = true;
		statusMsg = '';
		try {
			const res = await fetch('/api/pluggy/device', { method: 'POST' });
			const data = (await res.json()) as { deviceToken?: string; error?: string };
			if (!res.ok || !data.deviceToken) {
				statusMsg = data.error ?? 'Não foi possível gerar o código.';
				toast.error(statusMsg);
				return;
			}
			deviceToken = data.deviceToken;
			toast.success('Código de pareamento gerado. Cole na extensão para conectar.');
		} catch {
			statusMsg = 'Não foi possível gerar o código.';
			toast.error(statusMsg);
		} finally {
			pairingLoading = false;
		}
	}

	async function copyDeviceToken() {
		await navigator.clipboard.writeText(deviceToken);
		toast.success('Código copiado para a área de transferência.');
	}

	async function checkStatus() {
		checking = true;
		statusMsg = '';
		try {
			const res = await fetch('/api/pluggy/status');
			const data = (await res.json()) as {
				configured?: boolean;
				status?: string;
				error?: string;
			};
			if (!res.ok) {
				statusMsg = data.error ?? 'Não foi possível verificar agora.';
				toast.error(statusMsg);
				return;
			}
			if (!data.configured) {
				statusMsg =
					'Ainda não chegou nenhum token. Confira se a extensão está vinculada e abra o Meu Pluggy.';
				toast.warning(statusMsg);
				return;
			}
			const statusLabel =
				data.status === 'connected'
					? 'Conexão verificada: Open Finance já está ativo.'
					: 'Conexão encontrada! Sincronizando suas contas em segundo plano.';
			toast.success(statusLabel);
			await invalidateAll();
			onSuccess?.();
		} catch {
			statusMsg = 'Não foi possível verificar agora.';
			toast.error(statusMsg);
		} finally {
			checking = false;
		}
	}

	async function submitToken() {
		if (!token.trim()) {
			error = 'Cole o token de acesso do Meu Pluggy.';
			toast.error(error);
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
				toast.error(error);
				return;
			}
			toast.success('Open Finance conectado! Suas contas serão sincronizadas em instantes.');
			await invalidateAll();
			onSuccess?.();
		} catch {
			error = 'Não foi possível conectar. Tente novamente.';
			toast.error(error);
		} finally {
			submitting = false;
		}
	}

	async function skip() {
		statusMsg = '';
		try {
			const res = await fetch('/api/onboarding/finish', { method: 'POST' });
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				statusMsg = data?.error ?? 'Não foi possível pular agora.';
				toast.error(statusMsg);
				return;
			}
			toast.info('Onboarding pulado. Você pode conectar o Open Finance depois em Perfil.');
			await invalidateAll();
			onSuccess?.();
		} catch {
			statusMsg = 'Não foi possível pular agora.';
			toast.error(statusMsg);
		}
	}
</script>

{#snippet installAction()}
	<Button variant="outline" size="sm" onclick={() => (showInstallModal = true)}>Instalar</Button>
{/snippet}

{#snippet extInstall()}
	<p class="text-sm text-ink-soft">
		A extensão não está na Chrome Web Store: é uma pasta deste repositório que você carrega no
		Chrome como "extensão não compactada". O botão ao lado abre o passo a passo.
	</p>
{/snippet}

{#snippet pairAction()}
	{#if !deviceToken}
		<Button variant="outline" size="sm" onclick={generatePairing} disabled={pairingLoading}>
			{pairingLoading ? 'Gerando…' : 'Gerar código'}
		</Button>
	{/if}
{/snippet}

{#snippet extPair()}
	<p class="text-sm text-ink-soft">
		Gere um código de pareamento e cole no popup da extensão, no campo "Código de pareamento".
	</p>
	{#if deviceToken}
		<div class="flex items-center gap-2 border border-accent bg-accent-soft p-3">
			<code class="min-w-0 flex-1 truncate font-mono text-xs text-accent">{deviceToken}</code>
			<Button size="sm" variant="outline" onclick={copyDeviceToken}>Copiar</Button>
		</div>
		<p class="text-sm text-ink-faint">Agora cole esse código no popup da extensão.</p>
	{/if}
{/snippet}

{#snippet extConnect()}
	<p class="text-sm text-ink-soft">
		Abra
		<a href="https://meu.pluggy.ai/en/overview" target="_blank" rel="noreferrer">meu.pluggy.ai</a>
		e faça login: a extensão captura o token e sincroniza sozinha.
	</p>
{/snippet}

{#snippet tokenPanel()}
	No seu navegador (Chrome, Edge, Brave), aperte a tecla
	<kbd>F12</kbd>. Vai abrir uma janela nova ao lado da página.
{/snippet}

{#snippet tokenNetworkTab()}
	No topo dessa janela, clique na aba <strong>Rede</strong> (ou <strong>Network</strong>).
{/snippet}

{#snippet tokenReload()}
	Recarregue o Meu Pluggy (aperte
	<kbd>F5</kbd>). Vão aparecer várias linhas na lista.
{/snippet}

{#snippet tokenFindRow()}
	Na listinha, cada linha tem uma coluna <strong>Nome</strong> (no começo da linha). Os nomes são
	curtos, tipo
	<code>transactions</code>,
	<code>accounts</code>
	ou
	<code>items</code>. Clique em qualquer uma delas: as colunas de status, tipo, etc. são só
	informações técnicas, ignore.
{/snippet}

{#snippet tokenCopy()}
	Na janelinha que abrir à direita, clique na aba <strong>Cabeçalhos</strong> (ou
	<strong>Headers</strong>). Desça até achar "Authorization". O texto ao lado é o seu token: copie
	tudo, começando em
	<code>eyJ</code>.
{/snippet}

<div class="flex flex-col gap-4">
	<p class="text-sm text-ink-soft">
		O TAbelhaFin lê seus dados bancários pelo Meu Pluggy. Há duas formas de conectar: escolha a que
		preferir:
	</p>

	{#if error}
		<p class="text-sm text-danger">{error}</p>
	{/if}

	<div class="flex flex-col gap-2">
		<Tabs
			bind:value={connectMethod}
			items={[
				{ value: 'extension', label: 'Extensão automática' },
				{ value: 'manual', label: 'Token manual' }
			]}
		/>
		<p class="text-sm text-ink-faint">
			{connectMethod === 'extension'
				? 'Recomendada: instala a extensão uma vez e o token é capturado sozinho.'
				: 'Sem extensão: você copia o token uma vez, mas ele expira em ~24h e você refaz.'}
		</p>
	</div>

	{#if connectMethod === 'extension'}
		<Instruction.Steps>
			<Instruction.Step title="Instale a extensão." action={installAction}>
				{@render extInstall()}
			</Instruction.Step>
			<Instruction.Step title="Vincule a extensão." action={pairAction}>
				{@render extPair()}
			</Instruction.Step>
			<Instruction.Step title="Conecte no Meu Pluggy.">
				{@render extConnect()}
			</Instruction.Step>
		</Instruction.Steps>

		{#if statusMsg}
			<p class="text-sm text-danger">{statusMsg}</p>
		{/if}

		<Dialog.Actions>
			{#snippet start()}
				{#if skippable}
					<Button
						variant="ghost"
						onclick={skip}
						disabled={checking || pairingLoading || submitting}
					>
						Pular
					</Button>
				{/if}
			{/snippet}
			{#snippet end()}
				<Button onclick={checkStatus} disabled={checking || pairingLoading}>
					{checking ? 'Verificando…' : 'Já conectei: verificar'}
				</Button>
			{/snippet}
		</Dialog.Actions>
	{:else}
		<div class="flex flex-col gap-4 text-sm">
			<p class="text-sm text-ink-soft">
				O token é o "crachá" que comprova que é você. O Meu Pluggy mostra ele nas ferramentas de
				desenvolvedor do navegador: não se assuste com esse nome, é só um botão escondido.
			</p>

			<Instruction.Steps>
				<Instruction.Step title="Abra o painel do navegador">
					{@render tokenPanel()}
				</Instruction.Step>
				<Instruction.Step title="Vá na aba Rede">
					{@render tokenNetworkTab()}
				</Instruction.Step>
				<Instruction.Step title="Recarregue a página">
					{@render tokenReload()}
				</Instruction.Step>
				<Instruction.Step title="Ache a linha do token">
					{@render tokenFindRow()}
				</Instruction.Step>
				<Instruction.Step title="Copie o token">
					{@render tokenCopy()}
				</Instruction.Step>
			</Instruction.Steps>

			<p class="border-t border-rule pt-3 text-ink-soft">
				Se aparecer "Bearer" na frente (ex.: <em>Bearer eyJ...abc</em>), copie só a parte de depois
				do espaço. Aí é só colar aqui embaixo.
			</p>

			<div class="flex flex-col gap-2">
				<Label for="pluggy-setup-token">Token de acesso do Meu Pluggy</Label>
				<Input
					id="pluggy-setup-token"
					type="password"
					autocomplete="off"
					required
					placeholder="eyJhbGciOi..."
					bind:value={token}
				/>
				<p class="text-sm text-ink-faint">
					Começa com eyJ e pode ser comprido: pode colar inteiro.
				</p>
			</div>
		</div>

		<Dialog.Actions>
			{#snippet start()}
				{#if skippable}
					<Button variant="ghost" onclick={skip} disabled={submitting}>Pular</Button>
				{/if}
			{/snippet}
			{#snippet end()}
				<Button onclick={submitToken} disabled={submitting}>
					{submitting ? 'Validando…' : 'Salvar e conectar'}
				</Button>
			{/snippet}
		</Dialog.Actions>
	{/if}
</div>

<ExtensionInstallModal bind:open={showInstallModal} />
