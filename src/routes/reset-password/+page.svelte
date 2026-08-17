<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Input, Label, Card, Wordmark } from '@tabeladev/tabelawebui';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Redefinir senha — TabelaFin</title>
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
			<Card.Title>Redefinir senha</Card.Title>
			<Card.Description>Escolha uma nova senha para a sua conta.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if !data.hasToken}
				<div class="flex flex-col gap-4">
					<p class="text-sm text-danger">
						Este link está incompleto ou já foi usado. Peça um novo link de redefinição.
					</p>
					<Button href={resolve('/forgot-password')}>Pedir novo link</Button>
				</div>
			{:else}
				<form method="POST" use:enhance class="flex flex-col gap-4">
					<input type="hidden" name="token" value={data.token} />

					<div class="flex flex-col gap-2">
						<Label for="password">Nova senha</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autocomplete="new-password"
							minlength={8}
							required
						/>
					</div>

					<div class="flex flex-col gap-2">
						<Label for="confirm">Confirme a nova senha</Label>
						<Input
							id="confirm"
							name="confirm"
							type="password"
							autocomplete="new-password"
							minlength={8}
							required
						/>
					</div>

					{#if form?.error}
						<p class="text-sm text-danger">{form.error}</p>
					{/if}

					<Button type="submit">Redefinir senha</Button>
				</form>
			{/if}
		</Card.Content>
	</Card>
</div>
