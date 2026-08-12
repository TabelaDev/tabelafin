<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Input, Label, Card } from '@tabeladev/tabelawebui';
	import { resolve } from '$app/paths';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Entrar — TabelaFin</title>
</svelte:head>

<div class="relative mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
	<a
		href={resolve('/')}
		class="absolute top-6 left-6 font-mono text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
	>
		← tabelafin
	</a>
	<Card>
		<Card.Header>
			<Card.Title>TabelaFin</Card.Title>
			<Card.Description>Entre com sua conta para acessar suas finanças.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" use:enhance class="flex flex-col gap-4">
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

				{#if form?.error}
					<p class="text-sm text-danger">{form.error}</p>
				{/if}

				<Button type="submit">Entrar</Button>

				<p class="text-center text-sm text-ink-soft">
					Não tem uma conta?
					<a href={resolve('/signup')} class="text-accent hover:underline">Cadastre-se</a>
				</p>
			</form>
		</Card.Content>
	</Card>
</div>
