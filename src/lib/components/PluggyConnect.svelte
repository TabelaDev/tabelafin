<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button, toast } from '@tabelhadev/tabelhawebui';

	// The Pluggy Connect widget over CDN — it exposes a global `PluggyConnect`
	// once loaded, with no bundler or npm install needed (see ESCOPO.md §2.3).
	// Browser-only: the REST client in $lib/server/pluggy/client.ts is the one
	// restricted to plain fetch() so it can run in the Worker; this component has
	// no such restriction because it never runs in `workerd`.
	//
	// The CDN is pinned to v2.11.0 — the most recent versioned build confirmed to
	// be served from cdn.pluggy.ai (checked 2026-08-03: v2.10.0 and v2.11.0 both
	// answer 200; `latest` points at the same bundle as v2.11.0). The widget API
	// (connectToken/includeSandbox/onSuccess/onError/onClose/init) is the same as
	// v2.8.2 — checked against the published typings of
	// pluggy-connect-sdk@2.11.0 (dist/main/pluggy-connect.d.ts). The newest npm
	// version (2.14.1) has no matching CDN build yet.
	// Official example: github.com/pluggyai/quickstart/blob/master/frontend/html/index.html
	const PLUGGY_CONNECT_SCRIPT_URL =
		'https://cdn.pluggy.ai/pluggy-connect/v2.11.0/pluggy-connect.js';

	interface PluggyConnectItem {
		id: string;
	}

	// Shape confirmed through pluggy-connect-sdk (the same widget, packaged for
	// npm) — dist/main/pluggy-connect.d.ts, version 2.14.1.
	interface PluggyConnectOptions {
		connectToken: string;
		includeSandbox?: boolean;
		onSuccess: (data: { item: PluggyConnectItem }) => void;
		onError: (error: { message: string }) => void;
		onClose?: () => void;
	}

	interface PluggyConnectInstance {
		init(): Promise<void>;
	}

	interface PluggyConnectWindow {
		PluggyConnect: new (options: PluggyConnectOptions) => PluggyConnectInstance;
	}

	let status = $state<'idle' | 'loading' | 'connecting' | 'saving' | 'error'>('idle');
	let errorMessage = $state<string | null>(null);

	function loadScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			if ((window as unknown as Partial<PluggyConnectWindow>).PluggyConnect) {
				resolve();
				return;
			}
			const script = document.createElement('script');
			script.src = PLUGGY_CONNECT_SCRIPT_URL;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Falha ao carregar o widget da Pluggy.'));
			document.head.appendChild(script);
		});
	}

	// POSTs the itemId the widget handed back (data.item.id) to the endpoint that
	// fetches the real details from Pluggy and persists the account(s)/item.
	async function saveItem(itemId: string): Promise<void> {
		status = 'saving';
		try {
			const res = await fetch('/api/pluggy/items', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ itemId })
			});
			if (!res.ok) throw new Error('Não foi possível salvar a conexão.');
			toast.success('Conexão salva! Redirecionando para o dashboard.');
			await goto(resolve('/dashboard'));
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erro desconhecido.';
			status = 'error';
			errorMessage = message;
			toast.error(message);
			throw err;
		}
	}

	async function connect(): Promise<void> {
		status = 'loading';
		errorMessage = null;
		try {
			await loadScript();

			const tokenRes = await fetch('/api/pluggy/connect-token', { method: 'POST' });
			if (!tokenRes.ok) throw new Error('Não foi possível gerar o token de conexão.');
			const { connectToken } = (await tokenRes.json()) as { connectToken: string };

			const { PluggyConnect } = window as unknown as PluggyConnectWindow;
			status = 'connecting';
			const pluggyConnect = new PluggyConnect({
				connectToken,
				includeSandbox: false,
				onSuccess: (data) => {
					saveItem(data.item.id).catch((err: unknown) => {
						const message = err instanceof Error ? err.message : 'Erro desconhecido.';
						status = 'error';
						errorMessage = message;
						// toast.error já emitido em saveItem; evita duplicar
					});
				},
				onError: (err) => {
					status = 'error';
					errorMessage = err.message;
					toast.error(err.message);
				}
			});
			await pluggyConnect.init();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erro desconhecido.';
			status = 'error';
			errorMessage = message;
			toast.error(message);
		}
	}
</script>

<div class="flex flex-col gap-3">
	<Button
		onclick={connect}
		disabled={status === 'loading' || status === 'connecting' || status === 'saving'}
	>
		{#if status === 'idle' || status === 'error'}
			Conectar Nubank/XP
		{:else}
			Conectando...
		{/if}
	</Button>
	{#if errorMessage}
		<p class="text-sm text-danger">{errorMessage}</p>
	{/if}
</div>
