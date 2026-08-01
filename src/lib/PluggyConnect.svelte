<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';

	// Widget Pluggy Connect via CDN — expõe um `PluggyConnect` global depois de
	// carregado, sem precisar de bundler/npm install (ver ESCOPO.md §2.3). Só
	// roda no browser: o cliente REST em $lib/server/pluggy/client.ts é o que
	// fica restrito a fetch() puro pra rodar no Worker, esse componente não
	// tem essa restrição por não rodar em `workerd`.
	//
	// TODO(pluggy-verify): v2.8.2 foi a última build confirmada respondendo
	// 200 nesse CDN durante a pesquisa (a versão mais recente do pacote npm
	// equivalente, pluggy-connect-sdk@2.14.1, não tinha uma build
	// correspondente nesse CDN nesse momento) — conferir se já existe uma
	// versão mais nova antes de ir pra produção. Exemplo oficial confirmado:
	// github.com/pluggyai/quickstart/blob/master/frontend/html/index.html
	const PLUGGY_CONNECT_SCRIPT_URL = 'https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js';

	interface PluggyConnectItem {
		id: string;
	}

	// Shape confirmado via pluggy-connect-sdk (o mesmo widget, embalado como
	// pacote npm) — dist/main/pluggy-connect.d.ts, versão 2.14.1.
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

	// POSTa o itemId que o widget devolveu (data.item.id) pro endpoint que
	// busca os detalhes reais na Pluggy e persiste conta(s)/item.
	async function saveItem(itemId: string): Promise<void> {
		status = 'saving';
		const res = await fetch('/api/pluggy/items', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ itemId })
		});
		if (!res.ok) throw new Error('Não foi possível salvar a conexão.');
		await goto(resolve('/dashboard'));
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
						status = 'error';
						errorMessage = err instanceof Error ? err.message : 'Erro desconhecido.';
					});
				},
				onError: (err) => {
					status = 'error';
					errorMessage = err.message;
				}
			});
			await pluggyConnect.init();
		} catch (err) {
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Erro desconhecido.';
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
		<p class="text-sm text-destructive">{errorMessage}</p>
	{/if}
</div>
