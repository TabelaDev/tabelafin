<script lang="ts">
	/* eslint-disable svelte/no-at-html-tags -- SVGs inline estáticos controlados */
	import { page } from '$app/state';
	import { toggleMode, mode } from 'mode-watcher';
	import { resolve } from '$app/paths';
	import { FloatingActionPill, Status, StatusPill } from '@tabeladev/tabelawebui';
	import { onMount } from 'svelte';
	import ChatWidget from '$lib/ChatWidget.svelte';
	import OnboardingModal from '$lib/OnboardingModal.svelte';
	import StatementImportModal from '$lib/StatementImportModal.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Pill de status IA/Open Finance é fechável; a escolha persiste.
	const STATUS_HIDDEN_KEY = 'tabelafin.status-hidden';
	let statusVisible = $state(true);
	let statusInitialized = $state(false);
	onMount(() => {
		if (localStorage.getItem(STATUS_HIDDEN_KEY) === '1') statusVisible = false;
		statusInitialized = true;
	});
	$effect(() => {
		if (!statusInitialized) return;
		if (!statusVisible) localStorage.setItem(STATUS_HIDDEN_KEY, '1');
	});

	// Chat sidebar
	let chatOpen = $state(false);

	const NAV_ITEMS = [
		{ href: resolve('/dashboard'), label: 'Dashboard', icon: 'grid' },
		{ href: resolve('/transactions'), label: 'Transações', icon: 'list' },
		{ href: resolve('/upcoming'), label: 'Próximas', icon: 'calendar' },
		{ href: resolve('/accounts'), label: 'Contas', icon: 'wallet' },
		{ href: resolve('/categories'), label: 'Categorias', icon: 'tag' },
		{ href: resolve('/recurring'), label: 'Recorrências', icon: 'repeat' },
		{ href: resolve('/reports'), label: 'Relatórios', icon: 'file-text' },
		{ href: resolve('/profile'), label: 'Perfil', icon: 'user' }
	];

	const isActive = (href: string) => page.url.pathname === href;

	// Ícones SVG inline com width/height explícito — `class` em string JS não
	// é detectado pelo Tailwind, então o tamanho vem do atributo, não da classe.
	const NAV_PATHS: Record<string, string> = {
		grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
		list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
		tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="0.5" fill="currentColor"/>',
		wallet:
			'<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M21 12a2 2 0 0 0-2-2h-4a2 2 0 0 0 0 4h4a2 2 0 0 0 2-2Z"/>',
		calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
		user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
		repeat:
			'<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
		gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
		chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
		'file-text':
			'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>'
	};

	function iconSvg(icon: string): string {
		return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${NAV_PATHS[icon]}</svg>`;
	}

	const SUN_SVG =
		'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
	const MOON_SVG =
		'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
	const POWER_SVG =
		'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>';
</script>

<div class="flex min-h-svh bg-paper text-ink">
	<!-- Sidebar (desktop) — fixa; separators ponta a ponta, sem padding lateral -->
	<aside
		class="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-rule bg-paper-raised lg:flex"
	>
		<div class="px-5 pt-5 pb-4">
			<span class="font-mono text-xl font-bold text-accent">TabelaFin</span>
		</div>
		<div class="border-t border-rule"></div>
		<nav class="flex flex-1 flex-col gap-1 px-3 py-4">
			{#each NAV_ITEMS as item (item.href)}
				<a
					href={item.href}
					class="flex items-center gap-3 px-2 py-1.5 font-mono text-sm transition-colors {isActive(
						item.href
					)
						? 'border-l-2 border-accent pl-2 font-medium text-accent'
						: 'border-l-2 border-transparent pl-2 text-ink-soft hover:text-ink'}"
				>
					{@html iconSvg(item.icon)}
					{item.label}
				</a>
			{/each}
		</nav>
		<div class="border-t border-rule"></div>
		<div class="flex flex-col gap-1 px-3 py-4">
			<button
				onclick={toggleMode}
				class="flex cursor-pointer items-center gap-3 px-2 py-1.5 font-mono text-sm text-ink-soft transition-colors hover:text-ink"
			>
				{#if mode.current === 'dark'}
					{@html SUN_SVG}
				{:else}
					{@html MOON_SVG}
				{/if}
				{mode.current === 'dark' ? 'Tema claro' : 'Tema escuro'}
			</button>
			<form method="POST" action={resolve('/logout')}>
				<button
					type="submit"
					class="flex w-full cursor-pointer items-center gap-3 px-2 py-1.5 font-mono text-sm text-ctp-red transition-colors hover:text-ink"
				>
					{@html POWER_SVG}
					Sair
				</button>
			</form>
		</div>
	</aside>

	<!-- Conteúdo principal -->
	<div class="flex min-w-0 flex-1 flex-col">
		<main class="mx-auto w-full max-w-6xl flex-1 p-4 pb-24 lg:p-8 lg:pb-8">
			{@render children()}
		</main>
	</div>

	<!-- Bottom nav (mobile) — fixa no rodapé da viewport -->
	<nav class="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper-raised lg:hidden">
		<div class="flex items-center justify-around py-2">
			{#each NAV_ITEMS as item (item.href)}
				<a
					href={item.href}
					class="flex flex-col items-center gap-0.5 px-4 py-1 font-mono text-xs {isActive(item.href)
						? 'text-accent'
						: 'text-ink-soft'}"
				>
					{@html iconSvg(item.icon)}
					{item.label}
				</a>
			{/each}
		</div>
	</nav>

	<!-- Chat IA widget — flutuante, recolhível. Desktop: deslocado pra direita
	     da sidebar (w-60 = 15rem) pra não tampar tema/logout; mobile: acima da
	     bottom nav e da pill. As classes usam important pra vencer o CSS
	     scoped do componente (FloatingActionPill/StatusPill mantêm posição
	     própria fixa). -->
	{#if !data.hideAi}
		<ChatWidget
			bind:open={chatOpen}
			onclose={() => (chatOpen = false)}
			class="bottom-44! left-4! lg:bottom-24! lg:left-[16.75rem]!"
		/>
		<FloatingActionPill
			position="bottom-left"
			label="Abrir chat de IA"
			expandedLabel="Fechar chat"
			expanded={chatOpen}
			onclick={() => (chatOpen = !chatOpen)}
			class="bottom-28! left-4! lg:bottom-6! lg:left-[16rem]!"
		>
			{@html iconSvg('chat')}
			Chat IA
		</FloatingActionPill>
	{/if}

	<!-- Status IA/Open Finance — pill fixo, fechável; escolha persiste -->
	<StatusPill
		closable
		bind:visible={statusVisible}
		dismissLabel="Fechar status"
		class="bottom-20! lg:bottom-6!"
	>
		{#if !data.hideAi}
			<span class="text-ink-faint">IA:</span>
			{#if data.aiConfigured}
				<Status kind="success">configurada</Status>
			{:else}
				<a href={resolve('/profile')} class="text-danger hover:text-danger hover:underline"
					>não configurada</a
				>
			{/if}
			<span class="text-ink-faint">·</span>
		{/if}
		<span class="text-ink-faint">Open Finance:</span>
		{#if data.pluggyConfigured}
			<Status kind="success">conectado</Status>
		{:else}
			<a href={resolve('/profile')} class="text-danger hover:text-danger hover:underline"
				>não conectado</a
			>
		{/if}
	</StatusPill>

	<!-- Onboarding de primeiro acesso — abre sozinho pra quem nunca viu -->
	<OnboardingModal autoOpen={!data.seenOnboarding} />

	<!-- Importação em massa de extratos: montada no layout, e não na página que a
	     abre, porque a fila segue rodando depois de fechar o modal e navegar. -->
	<StatementImportModal />
</div>
