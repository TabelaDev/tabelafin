<script lang="ts">
	// Opt-in de notificação de relatório mensal pronto — ver ESCOPO.md §3.6.
	// Mesma convenção do TabelaCal (interagir via registration do próprio
	// navigator, não virtual:pwa-register) e o padrão de toasts do
	// $lib/ReloadPrompt.svelte.
	import { Button } from '@tabeladev/tabelawebui';
	import { toast } from '@tabeladev/tabelawebui';

	let { vapidPublicKey }: { vapidPublicKey: string } = $props();

	let permission = $state<NotificationPermission>(
		typeof Notification !== 'undefined' ? Notification.permission : 'default'
	);
	let subscribing = $state(false);

	const supported = $derived(
		typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
	);

	function base64UrlToUint8Array(base64Url: string): Uint8Array {
		const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
		const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(base64);
		return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
	}

	async function subscribe() {
		subscribing = true;
		try {
			const result = await Notification.requestPermission();
			permission = result;
			if (result !== 'granted') {
				toast.info('Permissão de notificações não concedida.');
				return;
			}

			const registration = await navigator.serviceWorker.ready;
			const subscription =
				(await registration.pushManager.getSubscription()) ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					// cast: TS's lib.dom espera um ArrayBuffer "não-compartilhado" em
					// BufferSource, mas o Uint8Array<ArrayBufferLike> daqui é compatível
					// em runtime.
					applicationServerKey: base64UrlToUint8Array(vapidPublicKey) as BufferSource
				}));

			const { endpoint, keys } = subscription.toJSON();
			const res = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ endpoint, keys })
			});
			if (!res.ok) throw new Error('subscribe request failed');

			toast.success('Notificação do relatório mensal ativada.');
		} catch {
			toast.error('Não foi possível ativar as notificações. Tente novamente.');
		} finally {
			subscribing = false;
		}
	}
</script>

{#if supported && permission !== 'granted'}
	<Button variant="default" disabled={subscribing} onclick={subscribe}>
		Avisar quando o relatório mensal estiver pronto
	</Button>
{/if}
