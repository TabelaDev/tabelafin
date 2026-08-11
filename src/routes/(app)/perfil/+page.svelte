<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button, Card } from '@tabeladev/tabelawebui';
	import { openOnboarding } from '$lib/onboarding-store';
	import { openStatementImport } from '$lib/statement-import-store';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let hideAiForm = $state<HTMLFormElement | null>(null);

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
	</Card>

	<!-- Ocultar IA -->
	<Card>
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
	</Card>

	{#if !data.hideAi}
		<!-- Categorização por IA (chave/modelo) -->
		<Card>
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
					<Button variant="outline" size="sm" onclick={() => openOnboarding('ai')}>Alterar</Button>
				{:else}
					<p class="font-mono text-xs text-ink-soft">Nenhuma chave configurada ainda.</p>
					<Button variant="primary" size="sm" onclick={() => openOnboarding('ai')}>
						Configurar IA
					</Button>
				{/if}
			</div>
		</Card>

		<!-- Configuração de IA (prompts) -->
		<a href={resolve('/perfil/ia')} class="block">
			<Card>
				<div class="flex items-center justify-between">
					<div>
						<h2 class="font-mono text-sm font-semibold">Configuração de IA</h2>
						<p class="mt-1 font-mono text-xs text-ink-soft">
							Customize como a IA categoriza transações, gera relatórios e responde no chat.
						</p>
					</div>
					<span class="font-mono text-sm text-accent">→</span>
				</div>
			</Card>
		</a>
	{/if}

	<!-- Categorias -->
	<a href={resolve('/perfil/categorias')} class="block">
		<Card>
			<div class="flex items-center justify-between">
				<div>
					<h2 class="font-mono text-sm font-semibold">Categorias</h2>
					<p class="mt-1 font-mono text-xs text-ink-soft">
						Crie e edite suas categorias de transação (nome e cor).
					</p>
				</div>
				<span class="font-mono text-sm text-accent">→</span>
			</div>
		</Card>
	</a>

	<!-- Importar extratos do Gmail via Takeout -->
	<Card>
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
	</Card>

	<!-- Open Finance -->
	<Card>
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
	</Card>
</div>
