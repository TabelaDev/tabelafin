<script lang="ts">
	import { Button, Dialog } from '@tabeladev/tabelawebui';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<!-- The extension lives in this repo and is not published to a store, so
     "installing" means loading it unpacked in Chrome — the same steps shown in
     the onboarding. Kept as a modal (shared with the profile card) so the
     instructions live in one place. -->
<Dialog bind:open title="Como instalar a extensão">
	<div class="flex flex-col gap-2 text-sm text-ink-soft">
		<p>
			<strong>1.</strong> Baixe o código:
			<a
				class="text-accent underline underline-offset-4 hover:opacity-80"
				href="https://github.com/TabelaDev/tabelafin"
				target="_blank"
				rel="noreferrer">github.com/TabelaDev/tabelafin</a
			>
			→ botão verde "Code" → "Download ZIP" → descompacte a pasta.
		</p>
		<p>
			<strong>2.</strong> Dentro do projeto, a extensão é a pasta
			<code class="border border-rule bg-paper-raised px-1 font-mono">extension/</code>.
		</p>
		<p>
			<strong>3.</strong> No Chrome, abra
			<code class="border border-rule bg-paper-raised px-1 font-mono">chrome://extensions</code>.
		</p>
		<p><strong>4.</strong> Ative o "Modo desenvolvedor" (canto superior direito).</p>
		<p>
			<strong>5.</strong> Clique em "Carregar sem compactação" e escolha a pasta
			<code class="border border-rule bg-paper-raised px-1 font-mono">extension/</code>.
		</p>
		<p><strong>6.</strong> Pronto — o ícone da extensão aparece na barra do navegador.</p>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Fechar</Button>
	{/snippet}
</Dialog>
