<script lang="ts">
	/* eslint-disable svelte/no-at-html-tags -- controlled, static inline SVGs */
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { AppShell, FloatingActionPill, Status, StatusPill } from '@tabeladev/tabelawebui';
	import { onMount } from 'svelte';
	import ChatWidget from '$lib/components/ChatWidget.svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import StatementImportModal from '$lib/components/StatementImportModal.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// AI/Open Finance status pill is dismissible; the choice persists.
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
		{ href: resolve('/dashboard'), label: 'Dashboard', icon: dashboardIcon },
		{ href: resolve('/transactions'), label: 'Transações', icon: transactionsIcon },
		{ href: resolve('/upcoming'), label: 'Parcelas futuras', icon: upcomingIcon },
		{ href: resolve('/accounts'), label: 'Contas', icon: accountsIcon },
		{ href: resolve('/categories'), label: 'Categorias', icon: categoriesIcon },
		{ href: resolve('/tags'), label: 'Tags', icon: tagsIcon },
		{ href: resolve('/recurring'), label: 'Recorrências', icon: recurringIcon },
		{ href: resolve('/reports'), label: 'Relatórios', icon: reportsIcon }
	];

	// Inline SVG icons with explicit width/height — Tailwind does not see `class`
	// inside JS strings, so the size comes from the attribute, not the class.
	const NAV_PATHS: Record<string, string> = {
		grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
		list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
		tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="0.5" fill="currentColor"/>',
		layers:
			'<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
		flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
		wallet:
			'<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M21 12a2 2 0 0 0-2-2h-4a2 2 0 0 0 0 4h4a2 2 0 0 0 2-2Z"/>',
		calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
		user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
		repeat:
			'<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
		'file-text':
			'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
		chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
	};

	function iconSvg(icon: string): string {
		return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${NAV_PATHS[icon]}</svg>`;
	}
</script>

{#snippet dashboardIcon()}
	{@html iconSvg('grid')}
{/snippet}
{#snippet transactionsIcon()}
	{@html iconSvg('list')}
{/snippet}
{#snippet upcomingIcon()}
	{@html iconSvg('calendar')}
{/snippet}
{#snippet accountsIcon()}
	{@html iconSvg('wallet')}
{/snippet}
{#snippet categoriesIcon()}
	{@html iconSvg('layers')}
{/snippet}
{#snippet tagsIcon()}
	{@html iconSvg('tag')}
{/snippet}
{#snippet recurringIcon()}
	{@html iconSvg('repeat')}
{/snippet}
{#snippet reportsIcon()}
	{@html iconSvg('file-text')}
{/snippet}
{#snippet profileIcon()}
	{@html iconSvg('user')}
{/snippet}

{#snippet profile()}
	<a
		href={resolve('/profile')}
		class="profile-link {page.url.pathname === resolve('/profile') ? 'profile-link-active' : ''}"
		aria-current={page.url.pathname === resolve('/profile') ? 'page' : undefined}
	>
		{@render profileIcon()}
		<span>Perfil</span>
	</a>
{/snippet}

<AppShell
	brand={{ prefix: 'Tabela', suffix: 'Fin' }}
	navItems={NAV_ITEMS}
	currentPath={page.url.pathname}
	logoutAction="/logout"
	{profile}
>
	{@render children()}
</AppShell>

<!-- AI chat widget — floating, collapsible. Desktop: offset to the right of
     the sidebar (w-60 = 15rem) so it does not overlap theme/logout; mobile:
     above the bottom nav and the pill. The classes use !important to beat the
     scoped CSS (FloatingActionPill/StatusPill keep their own fixed position). -->
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

<!-- AI/Open Finance status — fixed, dismissible pill; choice persists -->
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
	{#if data.pluggyStatus === 'expired'}
		<a href={resolve('/profile')} class="text-danger hover:text-danger hover:underline"
			>expirado (renove no Meu Pluggy)</a
		>
	{:else if data.pluggyConfigured}
		<Status kind="success">conectado</Status>
	{:else}
		<a href={resolve('/profile')} class="text-danger hover:text-danger hover:underline"
			>não conectado</a
		>
	{/if}
</StatusPill>

<!-- First-visit onboarding — opens by itself for users who never saw it -->
<OnboardingModal autoOpen={!data.seenOnboarding} />

<!-- Bulk statement import: mounted in the layout, not the page that opens
     it, because the queue keeps running after the modal closes and the user
     navigates. -->
<StatementImportModal />

<style>
	/* Profile in the sidebar footer — same look as the nav items, grouped with
	   the theme toggle and logout. The negative margin cancels the AppShell
	   wrapper padding (.twui-appshell-sidebar-profile) so the row aligns with
	   the rest of the footer. */
	.profile-link {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		margin: -2px -8px -4px;
		padding: 6px 8px;
		border-left: 2px solid transparent;
		font-family: var(--twui-font-mono, 'JetBrains Mono', monospace);
		font-size: 14px;
		line-height: 1.4;
		color: var(--twui-ink-soft);
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.profile-link:hover {
		color: var(--twui-accent);
	}

	.profile-link-active {
		border-left-color: var(--twui-accent);
		color: var(--twui-accent);
		font-weight: 500;
	}

	.profile-link-active:hover {
		color: var(--twui-accent);
	}
</style>
