<script lang="ts">
	import { Button, ChatMessage, Textarea } from '@tabeladev/tabelawebui';
	import { cubicOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';

	let {
		open = $bindable(),
		onclose,
		class: className = ''
	}: {
		open: boolean;
		onclose: () => void;
		class?: string;
	} = $props();

	let messages = $state<{ role: 'user' | 'assistant'; content: string }[]>([]);
	let input = $state('');
	let isStreaming = $state(false);
	let conversationId = $state<string | null>(null);

	async function sendMessage() {
		if (!input.trim() || isStreaming) return;

		const userMessage = input.trim();
		input = '';
		messages = [...messages, { role: 'user', content: userMessage }];
		isStreaming = true;

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: userMessage, conversationId })
			});

			if (!response.ok) {
				const err = (await response.json()) as { error?: string };
				messages = [
					...messages,
					{ role: 'assistant', content: `Erro: ${err.error || 'Falha ao enviar mensagem'}` }
				];
				isStreaming = false;
				return;
			}

			const reader = response.body!.getReader();
			const decoder = new TextDecoder();
			let assistantContent = '';

			messages = [...messages, { role: 'assistant', content: '' }];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const text = decoder.decode(value, { stream: true });
				const lines = text.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6).trim();
						if (!data) continue;

						try {
							const parsed = JSON.parse(data);

							if (parsed.error) {
								assistantContent += `\n\nErro: ${parsed.error}`;
							} else if (parsed.text) {
								assistantContent += parsed.text;
							} else if (parsed.done && parsed.conversationId) {
								conversationId = parsed.conversationId;
							}

							messages = [
								...messages.slice(0, -1),
								{ role: 'assistant', content: assistantContent }
							];
						} catch {
							// JSON parse error — skip malformed lines
						}
					}
				}
			}
		} catch (e) {
			messages = [
				...messages,
				{
					role: 'assistant',
					content: `Erro de conexão: ${e instanceof Error ? e.message : 'Desconhecido'}`
				}
			];
		} finally {
			isStreaming = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<!-- Floating AI chat widget — not a full-screen sidebar; opens as a fixed panel
     in the corner, positioned by the layout (sidebar offset on desktop). -->
{#if open}
	<div
		transition:scale={{ duration: 160, easing: cubicOut, start: 0.95 }}
		class="fixed z-50 flex max-h-[80svh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col border border-rule bg-paper shadow-[3px_3px_0_0_var(--twui-rule)] {className}"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-rule px-4 py-3">
			<h2 class="font-mono text-sm font-semibold">Chat IA</h2>
			<button onclick={onclose} class="cursor-pointer font-mono text-ink-soft hover:text-ink">
				✕
			</button>
		</div>

		<!-- Messages -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if messages.length === 0}
				<div class="flex h-full items-center justify-center">
					<p class="text-center font-mono text-sm text-ink-faint">
						Pergunte sobre seus gastos,<br />renda, ou finanças em geral.
					</p>
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each messages as msg, i (msg)}
						<div class="flex flex-col gap-1 {msg.role === 'user' ? 'items-end' : 'items-start'}">
							<span class="font-mono text-xs text-ink-faint">
								{msg.role === 'user' ? 'Você' : 'IA'}
							</span>
							<ChatMessage
								role={msg.role}
								content={msg.content}
								name={msg.role === 'user' ? 'Você' : 'IA'}
								streaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Input -->
		<div class="border-t border-rule p-4">
			<div class="flex gap-2">
				<Textarea
					bind:value={input}
					onkeydown={handleKeydown}
					placeholder="Pergunte algo..."
					rows={1}
					class="flex-1 resize-none"
				/>
				<Button onclick={sendMessage} disabled={isStreaming || !input.trim()} size="sm">
					{isStreaming ? '...' : '→'}
				</Button>
			</div>
		</div>
	</div>
{/if}
