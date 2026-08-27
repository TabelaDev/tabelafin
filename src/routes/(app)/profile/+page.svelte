<script lang="ts">
	import AiSetupDialog from '$lib/components/Dialogs/AiSetupDialog.svelte';
	import DeleteAccountDialog from '$lib/components/Dialogs/DeleteAccountDialog.svelte';
	import EraseDataDialog from '$lib/components/Dialogs/EraseDataDialog.svelte';
	import ImportStatementsDialog from '$lib/components/Dialogs/ImportStatementsDialog.svelte';
	import PluggySetupDialog from '$lib/components/Dialogs/PluggySetupDialog.svelte';
	import ExtensionInstallModal from '$lib/components/ExtensionInstallModal.svelte';
	import { PluggyStatus } from '$lib/enums/pluggy-status';
	import { handleAction } from '$lib/utils/forms';

	import { PUBLIC_TABELAHUB_URL } from '$env/static/public';

	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Badge, Button, Card, Divider, Input, Label, Page, Toggle } from '@tabeladev/tabelawebui';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let hideAiForm = $state<HTMLFormElement | null>(null);
	let showInstallModal = $state(false);
	let showDelete = $state(false);
	let showErase = $state(false);
	let showImport = $state(false);
	let showPluggySetup = $state(false);
	let showAiSetup = $state(false);
	let importTab = $state('takeout');

	const extensionLabel = $derived(
		page.data.pluggyStatus === PluggyStatus.Expired
			? 'Renovar'
			: page.data.pluggyStatus === PluggyStatus.Connected
				? 'Revisar'
				: 'Vincular'
	);

	const pluggyConfigured = $derived(page.data.pluggyStatus !== PluggyStatus.Disconnected);
	const pluggyExpired = $derived(page.data.pluggyStatus === PluggyStatus.Expired);

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

<Page.Shell>
	<Page.Header title="Perfil" subtitle="Gerencie sua conta e conexões." />

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
				{#if pluggyExpired}
					<Badge variant="danger">Expirado</Badge>
				{:else if pluggyConfigured}
					<Badge variant="success">Conectado</Badge>
				{:else}
					<Badge variant="danger">Não conectado</Badge>
				{/if}
				<Button size="sm" onclick={() => (showPluggySetup = true)}>
					{pluggyExpired ? 'Renovar' : pluggyConfigured ? 'Reconectar' : 'Conectar Open Finance'}
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
				<Button size="sm" onclick={() => (showPluggySetup = true)}>
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
					<Button size="sm" onclick={() => (showAiSetup = true)}>
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
					<Card.Action navigate />
				</Card.Header>
			</Card>
		</a>
	{/if}

	<!-- LGPD art. 18 -->
	<Divider label="Dados" />

	<a href={resolve('/profile/export')} class="block">
		<Card>
			<Card.Header>
				<div>
					<Card.Title>Exportar dados</Card.Title>
					<Card.Description>
						Baixe transações, contas, categorias, regras e mais nos formatos JSON, CSV ou Excel.
					</Card.Description>
				</div>
				<Card.Action navigate />
			</Card.Header>
		</Card>
	</a>

	<Card variant="danger">
		<Card.Header>
			<div>
				<Card.Title>Apagar meus dados</Card.Title>
				<Card.Description>
					Remove permanentemente transações, contas, categorias, tags, regras, recorrências,
					relatórios, conversas e credenciais. Sua conta e login serão mantidos.
				</Card.Description>
			</div>
			<Card.Action>
				<Button variant="danger" size="sm" onclick={() => (showErase = true)}>Apagar dados</Button>
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
</Page.Shell>

<!-- Account deletion dialog -->
<DeleteAccountDialog bind:open={showDelete} email={data.user?.email ?? ''} />

<!-- Erase data dialog -->
<EraseDataDialog bind:open={showErase} />

<!-- Import statements dialog -->
<ImportStatementsDialog
	bind:open={showImport}
	bind:importTab
	aiConfigured={data.aiConfigured}
	aiProvider={data.aiProvider}
	aiModel={data.aiModel}
/>

<!-- Pluggy setup dialog -->
<PluggySetupDialog bind:open={showPluggySetup} />

<!-- AI setup dialog -->
<AiSetupDialog bind:open={showAiSetup} />
