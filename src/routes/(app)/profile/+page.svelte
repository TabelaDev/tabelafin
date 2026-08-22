<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		Badge,
		Button,
		Card,
		Dialog,
		Divider,
		Input,
		Label,
		Select,
		Tabs,
		Toggle
	} from '@tabeladev/tabelawebui';
	import { PUBLIC_TABELAHUB_URL } from '$env/static/public';
	import { handleAction } from '$lib/utils/forms';
	import { openOnboarding } from '$lib/stores/onboarding-store';
	import { openStatementImport } from '$lib/stores/statement-import-store';
	import ExtensionInstallModal from '$lib/components/ExtensionInstallModal.svelte';
	import StatementUpload from '$lib/components/StatementUpload.svelte';
	import CsvImport from '$lib/components/CsvImport.svelte';
	import type { AiProvider } from '$lib/utils/ai-providers';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let hideAiForm = $state<HTMLFormElement | null>(null);
	let showInstallModal = $state(false);
	let showDelete = $state(false);
	let showImport = $state(false);
	let importTab = $state('takeout');

	const extensionLabel = $derived(
		page.data.pluggyStatus === 'expired'
			? 'Renovar'
			: page.data.pluggyStatus === 'connected'
				? 'Revisar'
				: 'Vincular'
	);

	let editingName = $state(false);
	let editName = $state('');

	function startEditName() {
		editName = data.user?.name ?? '';
		editingName = true;
	}

	function submitHideAi() {
		if (hideAiForm) {
			hideAiForm.requestSubmit();
		}
	}
</script>

<svelte:head>
	<title>Perfil: TabelaFin</title>
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
		<Card.Header>
			<div>
				<Card.Title>Dados da conta</Card.Title>
				<Card.Description>
					O nome completo é usado pra identificar Pix/TED entre suas próprias contas e não contá-los
					como renda.
				</Card.Description>
			</div>
			<Card.Action>
				{#if editingName}
					<Button size="sm" variant="ghost" onclick={() => (editingName = false)}>Cancelar</Button>
					<Button size="sm" type="submit" form="name-form">Salvar</Button>
				{:else}
					<Button size="sm" onclick={startEditName}>Editar</Button>
				{/if}
			</Card.Action>
		</Card.Header>
		<Card.Content>
			{#if editingName}
				<form
					id="name-form"
					method="POST"
					action="?/updateName"
					use:enhance={handleAction({ onSuccess: () => (editingName = false) })}
					class="flex flex-col gap-3"
				>
					<div class="flex flex-col gap-1.5">
						<Label for="editName">Nome completo</Label>
						<Input id="editName" name="name" bind:value={editName} class="w-full" required />
					</div>
					<p class="font-mono text-xs text-ink-faint">
						E-mail: <a
							href="{PUBLIC_TABELAHUB_URL}/account"
							target="_blank"
							rel="noreferrer"
							class="text-accent hover:underline">{data.user?.email}</a
						> · gerenciado pelo TabelaHub.
					</p>
				</form>
			{:else}
				<div class="flex flex-col gap-3">
					<div class="flex flex-col gap-1.5">
						<span class="font-mono text-xs text-ink-faint">Nome completo</span>
						<span class="font-mono text-sm">{data.user?.name || 'Não informado'}</span>
					</div>
					<p class="font-mono text-xs text-ink-faint">
						E-mail: <a
							href="{PUBLIC_TABELAHUB_URL}/account"
							target="_blank"
							rel="noreferrer"
							class="text-accent hover:underline">{data.user?.email}</a
						> · gerenciado pelo TabelaHub.
					</p>
				</div>
			{/if}
		</Card.Content>
	</Card>

	<Divider label="Open Finance" />

	<!-- Open Finance -->
	<Card>
		<Card.Header>
			<div>
				<Card.Title>Open Finance</Card.Title>
				<Card.Description>
					Sincroniza suas contas automaticamente. Sem conexão, você lança transações manualmente.
				</Card.Description>
			</div>
			<Card.Action>
				{#if data.pluggyConfigured}
					<Badge variant="success">Conectado</Badge>
				{:else}
					<Badge variant="danger">Não conectado</Badge>
				{/if}
				<Button size="sm" onclick={() => openOnboarding('pluggy')}>
					{data.pluggyConfigured ? 'Reconectar' : 'Conectar Open Finance'}
				</Button>
			</Card.Action>
		</Card.Header>
	</Card>

	<!-- Browser extension -->
	<Card>
		<Card.Header>
			<div>
				<Card.Title>Extensão do navegador</Card.Title>
				<Card.Description>
					Pega o token do Meu Pluggy automaticamente, sem copiar e colar. O token expira em ~24h e
					renova sozinho quando você abre o Meu Pluggy.
				</Card.Description>
			</div>
			<Card.Action>
				<Button size="sm" onclick={() => (showInstallModal = true)}>Instalar</Button>
				<Button size="sm" onclick={() => openOnboarding('pluggy')}>
					{extensionLabel}
				</Button>
			</Card.Action>
		</Card.Header>
	</Card>

	<ExtensionInstallModal bind:open={showInstallModal} />

	<!-- Import statements -->
	<Card>
		<Card.Header>
			<div>
				<Card.Title>Importar extratos</Card.Title>
				<Card.Description>
					Traz o histórico de extratos que chegaram por email, ou envie um arquivo avulso.
				</Card.Description>
			</div>
			<Card.Action>
				<Button onclick={() => (showImport = true)}>Importar</Button>
			</Card.Action>
		</Card.Header>
	</Card>

	<Divider label="IA" />

	<!-- Hide AI -->
	<Card>
		<Card.Header>
			<div>
				<Card.Title>Ocultar IA</Card.Title>
				<Card.Description>
					Esconde qualquer menção ou funcionalidade de inteligência artificial da interface.
				</Card.Description>
			</div>
			<Card.Action>
				<form
					method="POST"
					action="?/hideAi"
					bind:this={hideAiForm}
					use:enhance={handleAction()}
					class="flex items-center justify-between"
				>
					<Toggle name="hideAi" checked={data.hideAi} onchange={submitHideAi} label="Ativar" />
				</form>
			</Card.Action>
		</Card.Header>
	</Card>

	{#if !data.hideAi}
		<!-- AI categorisation -->
		<Card>
			<Card.Header>
				<div>
					<Card.Title>Categorização por IA</Card.Title>
					<Card.Description>
						Usada pra categorizar transações em lote. Sem IA, o app usa categorização por regras
						simples.
					</Card.Description>
				</div>
				<Card.Action>
					{#if data.aiConfigured}
						<Badge variant="success">Configurada</Badge>
					{:else}
						<Badge variant="danger">Não configurada</Badge>
					{/if}
					<Button size="sm" onclick={() => openOnboarding('ai')}>
						{data.aiConfigured ? 'Alterar' : 'Configurar IA'}
					</Button>
				</Card.Action>
			</Card.Header>
		</Card>

		<!-- AI configuration (prompts) -->
		<a href={resolve('/profile/ai')} class="block">
			<Card>
				<Card.Header>
					<div>
						<Card.Title>Configuração de IA</Card.Title>
						<Card.Description>
							Customize como a IA categoriza transações, gera relatórios e responde no chat.
						</Card.Description>
					</div>
					<Card.Action>
						<span class="font-mono text-sm text-accent">→</span>
					</Card.Action>
				</Card.Header>
			</Card>
		</a>
	{/if}

	<!-- LGPD art. 18 -->
	<Divider label="Dados" />

	<Card>
		<Card.Header>
			<div>
				<Card.Title>Exportar dados</Card.Title>
				<Card.Description>
					Baixe transações, contas, categorias, regras e credenciais em JSON.
				</Card.Description>
			</div>
			<Card.Action>
				<Button href="/api/account/export" size="sm" download>Baixar meus dados (JSON)</Button>
			</Card.Action>
		</Card.Header>
	</Card>

	<Card variant="danger">
		<Card.Header>
			<div>
				<Card.Title>Excluir minha conta</Card.Title>
				<Card.Description>
					Apaga permanentemente suas transações, contas, categorias, tags, regras, recorrências,
					relatórios, conversas e credenciais. Não dá pra desfazer.
				</Card.Description>
			</div>
			<Card.Action>
				<Button variant="danger" onclick={() => (showDelete = true)}>Excluir conta</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<p class="font-mono text-xs text-ink-faint">
				O que fazemos com seus dados está na
				<a href="{PUBLIC_TABELAHUB_URL}/privacidade" class="text-accent hover:underline">
					política de privacidade
				</a>.
			</p>
		</Card.Content>
	</Card>
</div>

<!-- Account deletion dialog -->
<Dialog bind:open={showDelete} title="Excluir minha conta">
	<form
		method="POST"
		action="?/deleteAccount"
		use:enhance={handleAction()}
		class="flex flex-col gap-4"
	>
		<p class="font-mono text-sm text-ink-soft">
			Isso apaga <strong>permanentemente</strong> suas transações, contas, categorias, tags, recorrências,
			relatórios, conversas e credenciais. Não dá pra desfazer.
		</p>
		<p class="font-mono text-sm text-ink-soft">
			Se quiser guardar uma cópia, baixe seus dados antes.
		</p>

		<div class="flex flex-col gap-2">
			<Label for="confirmEmail">
				Digite <span class="font-semibold">{' ' + data.user?.email + ' '}</span> para confirmar
			</Label>
			<Input id="confirmEmail" name="confirmEmail" type="email" autocomplete="off" required />
		</div>

		<div class="flex justify-end gap-2">
			<Button type="button" size="sm" onclick={() => (showDelete = false)}>Cancelar</Button>
			<Button type="submit" size="sm" variant="danger">Excluir definitivamente</Button>
		</div>
	</form>
</Dialog>

<!-- Import statements dialog -->
<Dialog bind:open={showImport} title="Importar extratos">
	<Tabs
		items={[
			{ value: 'takeout', label: 'Gmail Takeout' },
			{ value: 'pdf', label: 'PDF avulso' },
			{ value: 'csv', label: 'CSV' }
		]}
		bind:value={importTab}
	/>
	{#if importTab === 'takeout'}
		<div>
			<p class="mb-3 font-mono text-xs text-ink-soft">
				Exporte seus emails do Gmail com o filtro do banco. Cada extrato PDF/CSV/OFX é extraído
				automaticamente.
			</p>
			<Button
				onclick={() => {
					showImport = false;
					openStatementImport();
				}}>Importar Takeout</Button
			>
		</div>
	{:else if importTab === 'pdf'}
		<div>
			{#if data.aiConfigured && data.aiProvider && data.aiModel}
				<StatementUpload provider={data.aiProvider as AiProvider} model={data.aiModel} />
			{:else}
				<p class="font-mono text-xs text-ink-soft">
					Configure uma chave de IA em Perfil → IA antes de importar PDFs.
				</p>
			{/if}
		</div>
	{:else if importTab === 'csv'}
		<CsvImport onImported={() => (showImport = false)} />
	{/if}
</Dialog>
