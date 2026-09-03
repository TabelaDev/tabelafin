<script lang="ts">
	import { dev } from '$app/environment';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button, ErrorPage } from '@tabelhadev/tabelhawebui';

	let { error }: { error: App.Error } = $props();

	const status = $derived(page.status);

	const messages: Record<number, { title: string; description: string }> = {
		401: {
			title: 'Não autenticado',
			description: 'Faça login para continuar.'
		},
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
	<title>Erro {status}: TAbelhaFin</title>
</svelte:head>

<ErrorPage {status} title={info.title} description={info.description} homeHref={resolve('/')}>
	{#snippet actions()}
		{#if status === 401}
			<a href={resolve('/login')} class="no-underline">
				<Button>Fazer login</Button>
			</a>
		{/if}
	{/snippet}
</ErrorPage>
