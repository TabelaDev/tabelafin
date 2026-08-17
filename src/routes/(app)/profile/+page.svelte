<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { ActionResult } from '@sveltejs/kit';
	import { Button, Card, Dialog, Divider, Input, Label } from '@tabeladev/tabelawebui';
	import { openOnboarding } from '$lib/stores/onboarding-store';
	import { openStatementImport } from '$lib/stores/statement-import-store';
	import ExtensionInstallModal from '$lib/components/ExtensionInstallModal.svelte';
	import StatementUpload from '$lib/components/StatementUpload.svelte';
	import type { AiProvider } from '$lib/lib/ai-providers';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let hideAiForm = $state<HTMLFormElement | null>(null);
	let showInstallModal = $state(false);
	let showDelete = $state(false);

	// The extension button mirrors the Open Finance status (from the layout):
	// not connected → pair it; token expired → renew it; alive → review it.
	const extensionLabel = $derived(
		page.data.pluggyStatus === 'expired'
			? 'Renovar'
			: page.data.pluggyStatus === 'connected'
				? 'Revisar'
				: 'Vincular'
	);

	// Editable full name (needed to spot self-transfers — see the sync).
	let editingName = $state(false);
	let editName = $state('');
	let nameError = $state('');
	let nameDone = $state(false);

	function startEditName() {
		editName = data.user?.name ?? '';
		nameError = '';
		nameDone = false;
		editingName = true;
	}

	const handleNameForm = () => {
		return async ({ result }: { result: ActionResult }) => {
			await applyAction(result);
			if (result.type === 'failure') {
				nameError = String(result.data?.error ?? 'Não foi possível salvar.');
				return;
			}
			nameError = '';
			nameDone = true;
			editingName = false;
			await invalidateAll();
		};
	};

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

	<!-- Account details -->
	<Card>
		<Card.Content>
			<div class="flex flex-col gap-3">
				<h2 class="font-mono text-sm font-semibold">Dados da conta</h2>
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2">
						<span class="font-mono text-xs text-ink-faint">Nome completo:</span>
						{#if editingName}
							<form
								method="POST"
								action="?/updateName"
								use:enhance={handleNameForm}
								class="flex items-center gap-2"
							>
								<Input name="name" bind:value={editName} class="w-56" required />
								<Button type="submit" size="sm" variant="primary">Salvar</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onclick={() => (editingName = false)}>Cancelar</Button
								>
							</form>
						{:else}
							<span class="font-mono text-sm">{data.user?.name || 'Não informado'}</span>
							<Button type="button" size="sm" variant="ghost" onclick={startEditName}>Editar</Button
							>
						{/if}
					</div>
					{#if nameError}
						<p class="text-sm text-danger">{nameError}</p>
					{/if}
					{#if nameDone}
						<p class="text-sm text-ctp-green">
							Nome salvo — self-transfers serão corrigidos no próximo sync.
						</p>
					{/if}
					<div class="flex items-center gap-2">
						<span class="font-mono text-xs text-ink-faint">E-mail:</span>
						<span class="font-mono text-sm">{data.user?.email}</span>
					</div>
					<p class="font-mono text-xs text-ink-faint">
						O nome completo é usado pra identificar Pix/TED entre suas próprias contas e não
						contá-los como renda.
					</p>
				</div>
			</div>
		</Card.Content>
	</Card>

	<Divider label="Open Finance" />

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

	<!-- Browser extension (captures the Meu Pluggy token) -->
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
				<div class="flex flex-col items-stretch gap-2">
					<Button variant="outline" size="sm" onclick={() => (showInstallModal = true)}>
						Instalar
					</Button>
					<Button variant="outline" size="sm" onclick={() => openOnboarding('pluggy')}>
						{extensionLabel}
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card>

	<ExtensionInstallModal bind:open={showInstallModal} />

	<!-- Import Gmail statements via Takeout -->
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

	<!-- Single-PDF upload. The README and ESCOPO §2.4 have advertised this since
	     the first release, but nothing ever rendered the component — the only way
	     in was the bulk Takeout import above, which needs a .zip. Someone holding
	     one statement had no door. -->
	{#if data.aiConfigured && data.aiProvider && data.aiModel}
		<Card>
			<Card.Content>
				<div class="flex flex-col gap-3">
					<div>
						<h2 class="font-mono text-sm font-semibold">Enviar um extrato em PDF</h2>
						<p class="mt-1 font-mono text-xs text-ink-soft">
							Para um banco sem Open Finance, ou uma fatura avulsa.
						</p>
					</div>
					<StatementUpload provider={data.aiProvider as AiProvider} model={data.aiModel} />
				</div>
			</Card.Content>
		</Card>
	{/if}

	<Divider label="IA" />

	<!-- Hide AI -->
	<Card>
		<Card.Content>
			<form
				method="POST"
				action="?/hideAi"
				bind:this={hideAiForm}
				use:enhance={() => {
					return async ({ result }) => {
						await applyAction(result);
						// Reloads the layout (status pill/chat) after changing the preference.
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

	{#if !data.hideAi}
		<!-- AI categorisation (key/model) -->
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

		<!-- AI configuration (prompts) -->
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

	<!-- LGPD art. 18: the titular's rights, exercisable without asking anyone. -->
	<Card>
		<Card.Content>
			<div class="flex flex-col gap-3">
				<div>
					<h2 class="font-mono text-sm font-semibold">Seus dados</h2>
					<p class="mt-1 font-mono text-xs text-ink-soft">
						Baixe tudo o que é seu, ou apague a conta de vez.
					</p>
				</div>

				<div class="flex flex-wrap gap-2">
					<Button href="/api/account/export" variant="outline" size="sm" download>
						Baixar meus dados (JSON)
					</Button>
					<Button variant="outline" size="sm" onclick={() => (showDelete = true)}>
						Excluir minha conta
					</Button>
				</div>

				<p class="font-mono text-xs text-ink-faint">
					O que fazemos com seus dados está na
					<a href={resolve('/privacidade')} class="text-accent hover:underline">
						política de privacidade
					</a>.
				</p>
			</div>
		</Card.Content>
	</Card>
</div>

<!-- Account deletion. Typing the e-mail is the gate: this cascades across every
     table and cannot be undone, so a misclick must not be able to trigger it. -->
<Dialog bind:open={showDelete} title="Excluir minha conta">
	<form method="POST" action="?/deleteAccount" use:enhance class="flex flex-col gap-4">
		<p class="font-mono text-sm text-ink-soft">
			Isso apaga <strong>permanentemente</strong> suas transações, contas, categorias, tags, recorrências,
			relatórios, conversas e credenciais. Não dá pra desfazer.
		</p>
		<p class="font-mono text-sm text-ink-soft">
			Se quiser guardar uma cópia, baixe seus dados antes.
		</p>

		<div class="flex flex-col gap-2">
			<Label for="confirmEmail">
				Digite <span class="font-semibold">{data.user?.email}</span> para confirmar
			</Label>
			<Input id="confirmEmail" name="confirmEmail" type="email" autocomplete="off" required />
		</div>

		{#if page.form?.deleteError}
			<p class="font-mono text-sm text-danger">{page.form.deleteError}</p>
		{/if}

		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" size="sm" onclick={() => (showDelete = false)}>
				Cancelar
			</Button>
			<Button type="submit" size="sm">Excluir definitivamente</Button>
		</div>
	</form>
</Dialog>
