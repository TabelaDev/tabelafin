<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Input, Label, Card, Wordmark } from '@tabeladev/tabelawebui';
	import { resolve } from '$app/paths';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Criar conta — TabelaFin</title>
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
			<Card.Description>
				{#if form?.verificationSent}
					Falta um passo: confirme seu e-mail.
				{:else}
					Crie sua conta para começar a controlar suas finanças.
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<!-- With verification on, sign-up issues no session — the account exists
			     but is not usable until the link is clicked. Saying so here is the
			     whole point: redirecting into the app instead bounced the user to
			     /login seconds after signing up, with no mention of the e-mail. -->
			{#if form?.verificationSent}
				<div class="flex flex-col gap-4">
					<p class="text-sm">
						Enviamos um link de confirmação para
						<strong>{form.email}</strong>. Clique nele para ativar sua conta.
					</p>
					<p class="text-sm text-ink-soft">
						Não chegou? Confira a caixa de spam. O link vale por 1 hora.
					</p>
					<Button href={resolve('/login')} variant="outline">Ir para o login</Button>
				</div>
			{:else}
				<form method="POST" use:enhance class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<Label for="name">Nome completo</Label>
						<Input
							id="name"
							name="name"
							type="text"
							placeholder="Como aparece no seu banco"
							required
						/>
						<p class="text-xs text-ink-soft">
							Usado pra identificar Pix/TED entre suas próprias contas e não contá-los como renda.
						</p>
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

					{#if form?.error}
						<p class="text-sm text-danger">{form.error}</p>
					{/if}

					<Button type="submit">Criar conta</Button>

					<p class="text-center text-sm text-ink-soft">
						Já tem uma conta?
						<a href={resolve('/login')} class="text-accent hover:underline">Entrar</a>
					</p>
				</form>
			{/if}
		</Card.Content>
	</Card>
</div>
