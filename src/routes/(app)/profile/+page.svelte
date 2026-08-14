<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button, Card, Divider } from '@tabeladev/tabelawebui';
	import { openOnboarding } from '$lib/stores/onboarding-store';
	import { openStatementImport } from '$lib/stores/statement-import-store';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let hideAiForm = $state<HTMLFormElement | null>(null);
	let showExtInstall = $state(false);

	function submitHideAi() {
		if (hideAiForm) {
			hideAiForm.requestSubmit();
		}
	}
</script>

<svelte:head>
	<title>Perfil — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header>
		<h1 class="font-mono text-2xl font-bold">Perfil</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span> Gerencie sua conta e conexões.
		</p>
	</header>

	<!-- Dados da conta -->
	<Card>
		<Card.Content>
			<div class="flex flex-col gap-3">
				<h2 class="font-mono text-sm font-semibold">Dados da conta</h2>
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2">
						<span class="font-mono text-xs text-ink-faint">Nome:</span>
						<span class="font-mono text-sm">{data.user?.name || 'Não informado'}</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="font-mono text-xs text-ink-faint">E-mail:</span>
						<span class="font-mono text-sm">{data.user?.email}</span>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card>

	<!-- Open Finance -->
	<Card>
		<Card.Content>
			<div class="flex items-center justify-between gap-4">
				<div>
					<h2 class="font-mono text-sm font-semibold">Open Finance</h2>
					<p class="mt-1 font-mono text-xs text-ink-soft">
						Sincroniza suas contas automaticamente. Sem conexão, você lança transações manualmente.
					</p>
				</div>
				{#if data.pluggyConfigured}
					<span
						class="border border-signal bg-signal-soft px-3 py-1 font-mono text-xs font-medium text-signal"
						>Conectado</span
					>
				{:else}
					<span
						class="border border-danger bg-danger-soft px-3 py-1 font-mono text-xs font-medium text-danger"
						>Não conectado</span
					>
				{/if}
			</div>
			<div class="mt-3 flex items-center justify-between gap-3">
				{#if data.pluggyConfigured}
					<p class="font-mono text-xs text-ink-soft">Contas sincronizando automaticamente.</p>
					<Button variant="outline" size="sm" onclick={() => openOnboarding('pluggy')}>
						Reconectar
					</Button>
				{:else}
					<p class="font-mono text-xs text-ink-soft">Nenhuma conta conectada.</p>
					<Button variant="primary" size="sm" onclick={() => openOnboarding('pluggy')}>
						Conectar Open Finance
					</Button>
				{/if}
			</div>
		</Card.Content>
	</Card>

	<!-- Extensão do navegador (captura o token do Meu Pluggy) -->
	<Card>
		<Card.Content>
			<div class="flex items-center justify-between gap-4">
				<div>
					<h2 class="font-mono text-sm font-semibold">Extensão do navegador</h2>
					<p class="mt-1 font-mono text-xs text-ink-soft">
						Pega o token do Meu Pluggy automaticamente, sem copiar e colar. O token expira em ~24h e
						renova sozinho quando você abre o Meu Pluggy.
					</p>
				</div>
				<Button variant="outline" size="sm" onclick={() => openOnboarding('pluggy')}>
					Vincular / revisar
				</Button>
			</div>

			<button
				type="button"
				class="mt-3 cursor-pointer font-mono text-xs text-accent underline underline-offset-4 hover:opacity-80"
				onclick={() => (showExtInstall = !showExtInstall)}
			>
				{showExtInstall ? '▲ Ocultar como instalar' : '▼ Como instalar a extensão (passo a passo)'}
			</button>

			{#if showExtInstall}
				<div class="mt-3 flex flex-col gap-2 border border-rule bg-paper p-4 text-sm text-ink-soft">
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
					<p><strong>6.</strong> Pronto — o ícone da extensão aparece na barra do navegador.</p>
				</div>
			{/if}
		</Card.Content>
	</Card>

	<!-- Importar extratos do Gmail via Takeout -->
	<Card>
		<Card.Content>
			<div class="flex items-center justify-between gap-4">
				<div>
					<h2 class="font-mono text-sm font-semibold">Importar extratos</h2>
					<p class="mt-1 font-mono text-xs text-ink-soft">
						Traz o histórico de extratos que chegaram por email, a partir de um export do Google
						Takeout. Cada extrato é lido pelo seu modelo de IA.
					</p>
				</div>
				<Button variant="outline" onclick={() => openStatementImport()}>Importar</Button>
			</div>
		</Card.Content>
	</Card>

	<!-- Ocultar IA -->
	<Card>
		<Card.Content>
			<form
				method="POST"
				action="?/hideAi"
				bind:this={hideAiForm}
				use:enhance={() => {
					return async ({ result }) => {
						await applyAction(result);
						// Recarrega o layout (pill de status/chat) após mudar a preferência.
						if (result.type === 'success') await invalidateAll();
					};
				}}
				class="flex w-full items-center justify-between gap-4"
			>
				<div>
					<h2 class="font-mono text-sm font-semibold">Ocultar IA</h2>
					<p class="mt-1 font-mono text-xs text-ink-soft">
						Esconde qualquer menção ou funcionalidade de inteligência artificial da interface.
					</p>
				</div>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						name="hideAi"
						checked={data.hideAi}
						onchange={submitHideAi}
						class="h-4 w-4 accent-ctp-green"
					/>
					<span class="font-mono text-xs text-ink-soft">Ativar</span>
				</label>
			</form>
		</Card.Content>
	</Card>

	<div class="my-6">
		<Divider label="IA" />
	</div>

	{#if !data.hideAi}
		<!-- Categorização por IA (chave/modelo) -->
		<Card>
			<Card.Content>
				<div class="flex items-center justify-between gap-4">
					<div>
						<h2 class="font-mono text-sm font-semibold">Categorização por IA</h2>
						<p class="mt-1 font-mono text-xs text-ink-soft">
							Usada pra categorizar transações em lote. Sem IA, o app usa categorização por regras
							simples.
						</p>
					</div>
					{#if data.aiConfigured}
						<span
							class="border border-signal bg-signal-soft px-3 py-1 font-mono text-xs font-medium text-signal"
							>Configurada</span
						>
					{:else}
						<span
							class="border border-danger bg-danger-soft px-3 py-1 font-mono text-xs font-medium text-danger"
							>Não configurada</span
						>
					{/if}
				</div>
				<div class="mt-3 flex items-center justify-between gap-3">
					{#if data.aiConfigured}
						<p class="font-mono text-xs text-ink-soft">
							Provedor: {data.aiProvider} · Modelo: {data.aiModel}
						</p>
						<Button variant="outline" size="sm" onclick={() => openOnboarding('ai')}>Alterar</Button
						>
					{:else}
						<p class="font-mono text-xs text-ink-soft">Nenhuma chave configurada ainda.</p>
						<Button variant="primary" size="sm" onclick={() => openOnboarding('ai')}>
							Configurar IA
						</Button>
					{/if}
				</div>
			</Card.Content>
		</Card>

		<!-- Configuração de IA (prompts) -->
		<a href={resolve('/profile/ai')} class="block">
			<Card>
				<Card.Content>
					<div class="flex items-center justify-between">
						<div>
							<h2 class="font-mono text-sm font-semibold">Configuração de IA</h2>
							<p class="mt-1 font-mono text-xs text-ink-soft">
								Customize como a IA categoriza transações, gera relatórios e responde no chat.
							</p>
						</div>
						<span class="font-mono text-sm text-accent">→</span>
					</div>
				</Card.Content>
			</Card>
		</a>
	{/if}
</div>
