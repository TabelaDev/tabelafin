<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import PluggyConnect from '$lib/PluggyConnect.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// `stepOverride` só existe pra registrar o "salvei as credenciais agora"
	// dentro desta visita — o estado de base (já tinha credenciais ou não)
	// vem de `data`, então é derivado em vez de copiado pra um $state próprio.
	let stepOverride = $state<'connect' | null>(null);
	let step = $derived(stepOverride ?? (data.hasCredentials ? 'connect' : 'credentials'));

	$effect(() => {
		if (form?.success) stepOverride = 'connect';
	});
</script>

<svelte:head>
	<title>Conectar Open Finance — TabelaFin</title>
</svelte:head>

<div class="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-6 p-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>Conectar Open Finance</Card.Title>
			<Card.Description>
				Passo 2 de 2 — o TabelaFin não tem uma conta Pluggy comercial compartilhada. Você traz sua
				própria conexão via Meu Pluggy (gratuito por tempo indeterminado pra uso pessoal).
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-6">
			{#if step === 'credentials'}
				<ol class="flex flex-col gap-3 text-sm">
					<li>
						1. Crie uma conta gratuita no
						<a
							class="underline underline-offset-4"
							href="https://www.pluggy.ai/meu-pluggy"
							target="_blank"
							rel="noreferrer">Meu Pluggy</a
						>
						e conecte suas contas (mesmo CPF) — Nubank e XP — por lá.
					</li>
					<li>
						2. Gere um <strong>Client ID</strong> e um <strong>Client Secret</strong> ali mesmo.
					</li>
					<li>3. Cole as duas credenciais abaixo.</li>
				</ol>

				<form method="POST" use:enhance class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<Label for="clientId">Client ID</Label>
						<Input id="clientId" name="clientId" autocomplete="off" required />
					</div>

					<div class="flex flex-col gap-2">
						<Label for="clientSecret">Client Secret</Label>
						<Input
							id="clientSecret"
							name="clientSecret"
							type="password"
							autocomplete="off"
							required
						/>
					</div>

					{#if form?.error}
						<p class="text-sm text-destructive">{form.error}</p>
					{/if}

					<Button type="submit">Salvar credenciais</Button>
				</form>
			{:else}
				<p class="text-sm text-muted-foreground">
					Credenciais salvas. Agora conecte seu Nubank/XP pela janela da Pluggy — o botão abaixo
					abre o fluxo oficial de login bancário dentro do widget.
				</p>
				<PluggyConnect />
			{/if}
		</Card.Content>
	</Card.Root>
</div>
