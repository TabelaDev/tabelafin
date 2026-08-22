<script lang="ts">
	import { Button, Dialog, InstructionSteps } from '@tabeladev/tabelawebui';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

{#snippet step1()}
	Baixe o código:
	<a
		class="text-accent underline underline-offset-4 hover:opacity-80"
		href="https://github.com/TabelaDev/tabelafin"
		target="_blank"
		rel="noreferrer">github.com/TabelaDev/tabelafin</a
	>
	→ botão verde "Code" → "Download ZIP" → descompacte a pasta.
{/snippet}

{#snippet step2()}
	Dentro do projeto, a extensão é a pasta
	<code class="border border-rule bg-paper-raised px-1 font-mono">extension/</code>.
{/snippet}

{#snippet step3()}
	No Chrome, abra
	<code class="border border-rule bg-paper-raised px-1 font-mono">chrome://extensions</code>.
{/snippet}

{#snippet step4()}
	Ative o "Modo desenvolvedor" (canto superior direito).
{/snippet}

{#snippet step5()}
	Clique em "Carregar sem compactação" e escolha a pasta
	<code class="border border-rule bg-paper-raised px-1 font-mono">extension/</code>.
{/snippet}

{#snippet step6()}
	Pronto: o ícone da extensão aparece na barra do navegador.
{/snippet}

<Dialog bind:open title="Como instalar a extensão">
	<InstructionSteps
		steps={[
			{ content: step1 },
			{ content: step2 },
			{ content: step3 },
			{ content: step4 },
			{ content: step5 },
			{ content: step6 }
		]}
	/>
	{#snippet footer()}
		<Button onclick={() => (open = false)}>Fechar</Button>
	{/snippet}
</Dialog>
