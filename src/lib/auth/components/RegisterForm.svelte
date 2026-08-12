<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Input, Label, Card } from '@tabeladev/tabelawebui';

	let {
		action = '?/default',
		error = '',
		success = ''
	}: {
		action?: string;
		error?: string;
		success?: string;
	} = $props();
</script>

<Card>
	<Card.Header>
		<Card.Title>Criar conta</Card.Title>
		<Card.Description>Preencha os dados para se cadastrar.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" {action} use:enhance class="flex flex-col gap-4">
			<div class="flex flex-col gap-2">
				<Label for="name">Nome</Label>
				<Input id="name" name="name" type="text" placeholder="Seu nome" required />
			</div>

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
					autocomplete="new-password"
					minlength={8}
					required
				/>
			</div>

			{#if error}
				<p class="text-sm text-danger">{error}</p>
			{/if}

			{#if success}
				<p class="text-sm text-signal">{success}</p>
			{/if}

			<Button type="submit">Criar conta</Button>

			<p class="text-center text-sm text-ink-soft">
				Já tem uma conta?
				<a href={resolve('/login')} class="text-accent hover:underline">Entrar</a>
			</p>
		</form>
	</Card.Content>
</Card>
