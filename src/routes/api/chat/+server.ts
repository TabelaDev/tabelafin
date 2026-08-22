import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { getUserAiPrompts } from '$lib/server/db/user-ai-prompts';
import { createConversation, getConversation, getMessages, addMessage } from '$lib/server/db/chat';
import { getRecurringExpenses } from '$lib/server/db/recurring-expenses';
import { financeAccounts } from '$lib/server/db/schema';
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { transactions } from '$lib/server/db/schema';
import { classifyMovement, isNotInternalTransfer } from '$lib/server/db/transactions';
import { getTagTotals } from '$lib/server/db/tags';
import { sumSignedBalance } from '$lib/utils/accounts';
import { toReais } from '$lib/utils/money';
import { decryptSecret } from '$lib/server/crypto';
import { fetchWithRetry, type FetchWithRetryOptions } from '$lib/server/http';

// The chat answer is streamed, and the abort signal covers the response body —
// so the budget has to fit the whole answer, not just the handshake. 2048
// output tokens arrive well inside this; the timeout is here for a provider
// that accepts the connection and then goes quiet.
const STREAM_FETCH_OPTIONS: FetchWithRetryOptions = { timeoutMs: 120_000 };

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.userId) {
		return json({ error: 'Não autenticado' }, { status: 401 });
	}

	const body = (await request.json()) as { message?: string; conversationId?: string };
	const { message, conversationId } = body;

	if (typeof message !== 'string' || message.trim().length === 0) {
		return json({ error: 'Mensagem inválida' }, { status: 400 });
	}

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	const user = await locals.userService.findById(userId);
	if (user && !user.aiChatEnabled) {
		return json({ error: 'O chat de IA está desativado nas suas configurações.' }, { status: 403 });
	}

	// Get or create conversation
	let convId = conversationId;
	if (!convId) {
		const conv = await createConversation(db, userId, message.slice(0, 50));
		convId = conv.id;
	} else {
		const conv = await getConversation(db, convId, userId);
		if (!conv) {
			return json({ error: 'Conversa não encontrada' }, { status: 404 });
		}
	}

	// Save user message
	await addMessage(db, convId, 'user', message.trim());

	// Get AI credentials
	const aiCreds = await getAiCredentials(db, userId);
	if (!aiCreds) {
		return json(
			{ error: 'IA não configurada. Configure sua chave de API nas configurações.' },
			{ status: 400 }
		);
	}

	// Get custom chat prompt or use default
	const aiPrompts = await getUserAiPrompts(db, userId);
	const systemPrompt = aiPrompts.chatSystemPrompt || getDefaultChatPrompt();

	// Gather financial context
	const now = new Date();
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

	const [monthTransactions, userAccounts, recurringExpensesList, previousMessages] =
		await Promise.all([
			db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.userId, userId),
						isNull(transactions.supersededByTransactionId),
						isNotInternalTransfer,
						gte(transactions.date, monthStart)
					)
				)
				.orderBy(desc(transactions.date)),
			db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
			getRecurringExpenses(db, userId),
			getMessages(db, convId)
		]);

	// Build context
	const accountTypeById = new Map(userAccounts.map((a) => [a.id, a.type]));

	// Sign-aware split (a card purchase is positive but is spending — see
	// classifyMovement), consistent with the dashboard/categories.
	const splits = monthTransactions.map((t) =>
		classifyMovement(t.accountId ? accountTypeById.get(t.accountId) : undefined, t.amount)
	);
	const monthExpense = splits.reduce((sum, s) => sum + s.expense, 0);
	const monthIncome = splits.reduce((sum, s) => sum + s.income, 0);

	const categoryTotals: Record<string, number> = {};
	for (const [index, tx] of monthTransactions.entries()) {
		const { expense } = splits[index];
		if (expense !== 0) {
			const cat = tx.category ?? 'Outros';
			categoryTotals[cat] = (categoryTotals[cat] ?? 0) + expense;
		}
	}

	// Through sumSignedBalance, so a credit card's open invoice counts as debt
	// rather than as money on hand — summing cachedBalance raw made the assistant
	// quote a total well above what the dashboard showed, with the authority of a
	// direct answer.
	const totalBalance = sumSignedBalance(userAccounts);
	const recurringTotal = recurringExpensesList.reduce((sum, e) => sum + e.amount, 0);

	// Tags, month-scoped like the rest of the context — lets the AI answer
	// "quanto gastei na viagem SP".
	const tagTotals = await getTagTotals(db, userId, monthStart);

	const contextParts = [
		`Mês atual: ${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
		`Renda do mês: R$ ${toReais(monthIncome).toFixed(2)}`,
		`Gastos do mês: R$ ${toReais(monthExpense).toFixed(2)}`,
		`Saldo total: R$ ${toReais(totalBalance).toFixed(2)}`,
		`Gastos recorrentes mensais: R$ ${toReais(recurringTotal).toFixed(2)}`,
		`Gastos por categoria: ${
			Object.entries(categoryTotals)
				.map(([cat, val]) => `${cat}: R$ ${toReais(val).toFixed(2)}`)
				.join(', ') || 'nenhum'
		}`,
		`Gastos por tag: ${
			tagTotals
				.map((t) => `${t.name}: R$ ${toReais(t.expense).toFixed(2)}`)
				.filter((line) => !line.includes('R$ 0.00'))
				.join(', ') || 'nenhum'
		}`
	];

	const userContext = contextParts.join('\n');

	// Build messages for AI
	const historyMessages = previousMessages.slice(-20).map((m) => ({
		role: m.role as 'user' | 'assistant',
		content: m.content
	}));

	const aiMessages = [
		{
			role: 'system' as const,
			content: `${systemPrompt}\n\nContexto financeiro do usuário:\n${userContext}`
		},
		...historyMessages,
		{ role: 'user' as const, content: message.trim() }
	];

	// Stream response
	const encoder = new TextEncoder();

	// Decrypt AI API key
	let apiKey: string;
	try {
		apiKey = await decryptSecret(
			platform!.env.MASTER_KEY,
			{ ciphertext: aiCreds.keyEncrypted, nonce: aiCreds.nonce, v: aiCreds.v ?? undefined },
			{ purpose: 'ai_credentials', userId: locals.userId }
		);
	} catch {
		return json({ error: 'Erro ao descriptografar chave de IA' }, { status: 500 });
	}

	const stream = new ReadableStream({
		async start(controller) {
			try {
				let fullResponse = '';

				if (aiCreds.provider === 'anthropic') {
					const res = await fetchWithRetry(
						'https://api.anthropic.com/v1/messages',
						{
							method: 'POST',
							headers: {
								'content-type': 'application/json',
								'x-api-key': apiKey,
								'anthropic-version': '2023-06-01'
							},
							body: JSON.stringify({
								model: aiCreds.model,
								max_tokens: 2048,
								system: aiMessages[0].content,
								messages: aiMessages.slice(1),
								stream: true
							})
						},
						STREAM_FETCH_OPTIONS
					);

					if (!res.ok) {
						const err = await res.text();
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: `Erro na API: ${err}` })}\n\n`)
						);
						controller.close();
						return;
					}

					const reader = res.body?.getReader();
					if (!reader) {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: 'Sem stream' })}\n\n`)
						);
						controller.close();
						return;
					}

					const decoder = new TextDecoder();
					let buffer = '';

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() ?? '';

						for (const line of lines) {
							if (line.startsWith('data: ')) {
								const data = line.slice(6).trim();
								if (data === '[DONE]') continue;
								try {
									const parsed = JSON.parse(data);
									if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
										fullResponse += parsed.delta.text;
										controller.enqueue(
											encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`)
										);
									}
								} catch {
									// skip malformed SSE lines
								}
							}
						}
					}
				} else {
					// OpenAI / DeepSeek compatible
					const apiUrl =
						aiCreds.provider === 'openai'
							? 'https://api.openai.com/v1/chat/completions'
							: 'https://api.deepseek.com/chat/completions';

					const res = await fetchWithRetry(
						apiUrl,
						{
							method: 'POST',
							headers: {
								'content-type': 'application/json',
								authorization: `Bearer ${apiKey}`
							},
							body: JSON.stringify({
								model: aiCreds.model,
								messages: aiMessages,
								stream: true
							})
						},
						STREAM_FETCH_OPTIONS
					);

					if (!res.ok) {
						const err = await res.text();
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: `Erro na API: ${err}` })}\n\n`)
						);
						controller.close();
						return;
					}

					const reader = res.body?.getReader();
					if (!reader) {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: 'Sem stream' })}\n\n`)
						);
						controller.close();
						return;
					}

					const decoder = new TextDecoder();
					let buffer = '';

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() ?? '';

						for (const line of lines) {
							if (line.startsWith('data: ')) {
								const data = line.slice(6).trim();
								if (data === '[DONE]') continue;
								try {
									const parsed = JSON.parse(data);
									const content = parsed.choices?.[0]?.delta?.content;
									if (content) {
										fullResponse += content;
										controller.enqueue(
											encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
										);
									}
								} catch {
									// skip malformed SSE lines
								}
							}
						}
					}
				}

				// Save assistant response
				if (fullResponse) {
					await addMessage(db, convId, 'assistant', fullResponse);
				}

				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`)
				);
			} catch (e) {
				const msg =
					e instanceof Error && e.message.includes('fetch')
						? 'Erro de conexão com a IA'
						: 'Erro ao gerar resposta';
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};

function getDefaultChatPrompt(): string {
	return (
		`Você é um assistente financeiro pessoal do TabelaFin. ` +
		`Responda em português do Brasil, de forma direta e prática. ` +
		`Use os dados financeiros do usuário fornecidos no contexto pra dar respostas precisas. ` +
		`Seja conciso e objetivo. Quando apropriado, sugira ações concretas. ` +
		`Não invente dados — se não tiver informação suficiente, peça esclarecimento.`
	);
}
