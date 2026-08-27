<script lang="ts">
	import { Button, Dialog, Instruction } from '@tabeladev/tabelawebui';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog bind:open title="Como instalar a extensão">
	<Instruction.Steps>
		<Instruction.Step title="Acesse e baixe o código">
			Acesse
			<a href="https://github.com/TabelaDev/tabelafin" target="_blank" rel="noreferrer"
				>github.com/TabelaDev/tabelafin</a
			>
			no seu navegador. No repositório, clique no botão verde <code>Code</code> e depois em
			<code>Download ZIP</code>.
			<img
				src="/onboarding/install-1.png"
				alt="Botão verde Code no GitHub"
				class="mt-3 w-full rounded border border-rule"
			/>
			<img
				src="/onboarding/install-1b.png"
				alt="Opção Download ZIP no menu Code"
				class="mt-3 w-full rounded border border-rule"
			/>
		</Instruction.Step>
		<Instruction.Step title="Extraia a pasta">
			Vai baixar um arquivo <code>tabelafin-main.zip</code>. Clique duas vezes para descompactar e
			localize a pasta <code>extension/</code> que está dentro dela.
		</Instruction.Step>
		<Instruction.Step title="Abra as extensões do Chrome">
			No Chrome, abra <a href="chrome://extensions">chrome://extensions</a>.
		</Instruction.Step>
		<Instruction.Step title="Ative o Modo desenvolvedor">
			No canto superior direito, ative o <strong>Modo desenvolvedor</strong>.
			<img
				src="/onboarding/install-2.png"
				alt="Alternar Modo do desenvolvedor no chrome://extensions"
				class="mt-3 w-full rounded border border-rule"
			/>
		</Instruction.Step>
		<Instruction.Step title="Carregue a extensão">
			Clique em <code>Carregar sem compactação</code> e escolha a pasta
			<code>extension/</code> que você extraiu.
			<img
				src="/onboarding/install-3.png"
				alt="Botão Carregar sem compactação no chrome://extensions"
				class="mt-3 w-full rounded border border-rule"
			/>
		</Instruction.Step>
		<Instruction.Step title="Fixe na barra">
			Pronto: o ícone da extensão aparece na barra do navegador. Clique no pininho para deixá-lo
			fixo.
		</Instruction.Step>
	</Instruction.Steps>
	{#snippet footerEnd()}
		<Button onclick={() => (open = false)}>Fechar</Button>
	{/snippet}
</Dialog>
