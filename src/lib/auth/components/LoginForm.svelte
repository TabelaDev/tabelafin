<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Input, Label, Card } from '@tabeladev/tabelawebui';

	let {
		action = '?/default',
		error = '',
		title = 'Entrar',
		description = 'Entre com sua conta para acessar.'
	}: {
		action?: string;
		error?: string;
		title?: string;
		description?: string;
	} = $props();
</script>

<Card {title} {description}>
	<form method="POST" {action} use:enhance class="flex flex-col gap-4">
		<div class="flex flex-col gap-2">
			<Label for="email">E-mail</Label>
			<Input id="email" name="email" type="email" placeholder="seu@email.com" required />
		</div>

		<div class="flex flex-col gap-2">
			<Label for="password">Senha</Label>
			<Input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>

		{#if error}
			<p class="text-sm text-destructive">{error}</p>
		{/if}

		<Button type="submit">Entrar</Button>

		<p class="text-center text-sm text-ink-soft">
			Não tem uma conta?
			<a href={resolve('/signup')} class="text-accent hover:underline">Cadastre-se</a>
		</p>
	</form>
</Card>
