<script lang="ts">
	import { PUBLIC_APP_URL, PUBLIC_TABELHAUTH_URL } from '$env/static/public';

	import { Button, MarketingShell } from '@tabelhadev/tabelhawebui';

	let { children } = $props();
</script>

<MarketingShell
	suffix="Fin"
	footerLinks={[
		{ href: `${PUBLIC_TABELHAUTH_URL}/privacidade`, label: 'Privacidade' },
		{ href: `${PUBLIC_TABELHAUTH_URL}/termos`, label: 'Termos de uso' },
		{ href: 'https://github.com/TAbelhaDev/tabelhafin', label: 'Código-fonte' }
	]}
	footerLicense="AGPL-3.0 · SvelteKit + Cloudflare Workers"
>
	{#snippet actions()}
		<Button
			href="{PUBLIC_TABELHAUTH_URL}/login?redirect={encodeURIComponent(
				PUBLIC_APP_URL + '/api/auth/hub-callback'
			)}"
			variant="ghost"
			size="sm">Entrar</Button
		>
	{/snippet}
	{@render children()}
</MarketingShell>
