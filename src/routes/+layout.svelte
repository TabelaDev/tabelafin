<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import { Toaster, toast } from '@tabeladev/tabelawebui';
	import { ToastType } from '$lib/enums/toast-type';
	import { pwaInfo } from 'virtual:pwa-info';
	import { getFlash } from 'sveltekit-flash-message';
	import ReloadPrompt from '$lib/ReloadPrompt.svelte';

	let { children } = $props();

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	const flash = getFlash(page);

	$effect(() => {
		const f = $flash;
		if (!f) return;

		if (f.type === ToastType.success) {
			toast.success(f.message);
		} else if (f.type === ToastType.error) {
			toast.error(f.message);
		} else if (f.type === ToastType.info) {
			toast.info(f.message);
		} else if (f.type === ToastType.warning) {
			toast.warning(f.message);
		}

		// Limpa o flash após mostrar o toast pra evitar re-trigger
		$flash = undefined;
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" sizes="48x48" />
	<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- gerado pelo plugin (virtual:pwa-info), não é input do usuário -->
	{@html webManifestLink}
</svelte:head>
<ModeWatcher lightClassNames={['light']} darkClassNames={['dark']} />
<Toaster />
<ReloadPrompt />
{@render children()}
