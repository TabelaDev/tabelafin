<script lang="ts">
	import { PUBLIC_APP_URL, PUBLIC_TABELAHUB_URL } from '$env/static/public';

	import { Button, MarketingShell } from '@tabeladev/tabelawebui';

	let { children } = $props();
</script>

<MarketingShell
	suffix="Fin"
	footerLinks={[
		{ href: `${PUBLIC_TABELAHUB_URL}/privacidade`, label: 'Privacidade' },
		{ href: `${PUBLIC_TABELAHUB_URL}/termos`, label: 'Termos de uso' },
		{ href: 'https://github.com/TabelaDev/tabelafin', label: 'Código-fonte' }
	]}
	footerLicense="AGPL-3.0 · SvelteKit + Cloudflare Workers"
>
	{#snippet actions()}
		<Button
			href="{PUBLIC_TABELAHUB_URL}/login?redirect={encodeURIComponent(
				PUBLIC_APP_URL + '/api/auth/hub-callback'
			)}"
			variant="ghost"
			size="sm">Entrar</Button
		>
	{/snippet}
	{@render children()}
</MarketingShell>
