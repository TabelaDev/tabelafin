<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Input, Label, Card, Wordmark } from '@tabeladev/tabelawebui';
	import { resolve } from '$app/paths';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Esqueci minha senha — TabelaFin</title>
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
			<Card.Title>Esqueci minha senha</Card.Title>
			<Card.Description>
				Enviamos um link de redefinição para o seu e-mail. O link vale por 1 hora.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if form?.sent}
				<div class="flex flex-col gap-4">
					<p class="text-sm text-ink-soft">
						Se existir uma conta com esse e-mail, o link já está a caminho. Confira também a caixa
						de spam.
					</p>
					<Button href={resolve('/login')} variant="outline">Voltar para o login</Button>
				</div>
			{:else}
				<form method="POST" use:enhance class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<Label for="email">E-mail</Label>
						<Input id="email" name="email" type="email" placeholder="seu@email.com" required />
					</div>

					{#if form?.error}
						<p class="text-sm text-danger">{form.error}</p>
					{/if}

					<Button type="submit">Enviar link</Button>

					<p class="text-center text-sm text-ink-soft">
						Lembrou a senha?
						<a href={resolve('/login')} class="text-accent hover:underline">Entrar</a>
					</p>
				</form>
			{/if}
		</Card.Content>
	</Card>
</div>
