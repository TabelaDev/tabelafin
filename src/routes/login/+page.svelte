<script lang="ts">
	import { PUBLIC_APP_URL, PUBLIC_TABELHAUTH_URL } from '$env/static/public';

	import { resolve } from '$app/paths';
	import { Button, Card, Wordmark } from '@tabelhadev/tabelhawebui';
</script>

<svelte:head>
	<title>Entrar: TabelaFin</title>
</svelte:head>

<div class="relative mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
	<a
		href={resolve('/')}
		class="absolute top-6 left-6 font-mono text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
	>
		← <Wordmark prefix="Tabela" suffix="Fin" />
	</a>
	<Card>
		<Card.Header>
			<Card.Title><Wordmark prefix="Tabela" suffix="Fin" /></Card.Title>
			<Card.Description>Redirecionando para o login...</Card.Description>
		</Card.Header>
		<Card.Content>
			<p class="text-sm text-ink-soft">O login é feito pelo TabelaAuth.</p>
			<Button
				href="{PUBLIC_TABELHAUTH_URL}/login?redirect={encodeURIComponent(
					PUBLIC_APP_URL + '/api/auth/hub-callback'
				)}"
				class="w-full"
			>
				Ir para o login
			</Button>
		</Card.Content>
	</Card>
</div>
