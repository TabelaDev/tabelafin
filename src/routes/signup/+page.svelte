<script lang="ts">
	import { Button, Card, Wordmark } from '@tabeladev/tabelawebui';
	import { resolve } from '$app/paths';
	import { PUBLIC_TABELAHUB_URL, PUBLIC_APP_URL } from '$env/static/public';
</script>

<svelte:head>
	<title>Criar conta: TabelaFin</title>
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
			<Card.Description>Redirecionando para o cadastro...</Card.Description>
		</Card.Header>
		<Card.Content>
			<p class="text-sm text-ink-soft">O cadastro é feito pelo TabelaHub.</p>
			<Button
				href="{PUBLIC_TABELAHUB_URL}/signup?redirect={encodeURIComponent(
					PUBLIC_APP_URL + '/api/auth/hub-callback'
				)}"
				class="w-full"
			>
				Ir para o cadastro
			</Button>
		</Card.Content>
	</Card>
</div>
