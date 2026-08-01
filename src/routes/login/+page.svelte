<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Entrar — TabelaFin</title>
</svelte:head>

<div class="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>TabelaFin</Card.Title>
			<Card.Description>Cole o token de acesso da sua instância.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" use:enhance class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<Label for="token">Token de acesso</Label>
					<Input id="token" name="token" type="password" autocomplete="off" required />
				</div>

				{#if form?.error}
					<p class="text-sm text-destructive">{form.error}</p>
				{/if}

				<Button type="submit">Entrar</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
