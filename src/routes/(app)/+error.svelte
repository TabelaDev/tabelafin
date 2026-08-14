<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ErrorPage } from '@tabeladev/tabelawebui';

	let { error }: { error: App.Error } = $props();

	const status = $derived(page.status);

	const messages: Record<number, { title: string; description: string }> = {
		403: {
			title: 'Acesso negado',
			description: 'Você não tem permissão para acessar esta página.'
		},
		404: {
			title: 'Página não encontrada',
			description: 'A página que você procura não existe ou foi movida.'
		},
		500: {
			title: 'Erro interno',
			description: 'Algo deu errado do nosso lado. Tente novamente em alguns instantes.'
		}
	};

	const info = $derived(
		messages[status] ?? {
			title: dev ? error?.message || 'Algo deu errado' : 'Algo deu errado',
			description: 'Tente novamente ou volte ao início.'
		}
	);
</script>

<svelte:head>
	<title>Erro {status} — TabelaFin</title>
</svelte:head>

<ErrorPage
	{status}
	title={info.title}
	description={info.description}
	homeHref={resolve('/dashboard')}
	homeLabel="Voltar ao dashboard"
	class="app-error"
/>

<style>
	/* Inside the (app) shell the <main> already has padding and a background; the
	   min-h-svh alone here only ensures a consistent background. */
	:global(.app-error) {
		min-height: auto;
		background: transparent;
		padding: 48px 0;
	}
</style>
