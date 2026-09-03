// Batch AI categorisation (ESCOPO.md §3.3): never one call per transaction, and
// never recurring on each dashboard view. Same fetch-based dispatch pattern
// (Anthropic/OpenAI/DeepSeek) as TAbelhaCal (server/ai/parse.ts): no SDK, only
// fetch(), so it runs in `workerd`.
//
// "One call per sync" was the original rule, but it does not survive a real
// first sync: an account with a full history yields thousands of transactions,
// and the model has to emit one result object per transaction. Past a few
// hundred the response gets truncated, the tool_use payload comes back as
// invalid JSON, and *nothing* is categorised — after the user already paid for
// the call. So the batch is capped and the run is split into several calls.
import { DEFAULT_CATEGORIZATION_PROMPT } from '$lib/prompts';
import { fetchWithRetry } from '$lib/server/http';
import type { AiProvider } from '$lib/utils/ai-providers';
import { toReais } from '$lib/utils/money';

// Transactions per provider call. Each result is a small object
// (`{"id": "<uuid>", "category": "<name>"}`), so 100 of them fit comfortably in
// the output budget below while keeping the number of calls low.
const BATCH_SIZE = 100;

// Output budget for one batch: ~48 tokens per result (a 36-char uuid plus the
// category name and JSON punctuation) plus room for the tool-call envelope.
function maxTokensForBatch(count: number): number {
	return Math.min(16000, 512 + count * 48);
}

function chunk<T>(items: T[], size: number): T[][] {
	const batches: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		batches.push(items.slice(i, i + size));
	}
	return batches;
}

export interface TransactionToCategorize {
	id: string;
	description: string;
	// Integer centavos. Converted to reais for the prompt — see formatTransactions.
	amount: number;
	date: string; // ISO 8601
}

export interface CategorizedTransaction {
	id: string;
	category: string;
}

interface CategorizeInput {
	provider: AiProvider;
	model: string;
	apiKey: string;
	// The user's own categories — both the prompt and the tool-calling schema use
	// this list, not a fixed taxonomy.
	categories: string[];
	// The user's custom prompt (see /profile/ai) — it replaces the default system
	// prompt when present.
	customPrompt?: string;
	transactions: TransactionToCategorize[];
}

function categorizeSchema(categories: string[]) {
	return {
		type: 'object',
		properties: {
			results: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string', description: 'O mesmo id da transação fornecida no contexto' },
						category: { type: 'string', enum: categories }
					},
					required: ['id', 'category']
				},
				description: 'Uma entrada por transação fornecida no contexto, na mesma quantidade.'
			}
		},
		required: ['results']
	};
}

const CATEGORIZE_TOOL = {
	name: 'categorize_transactions',
	description: 'Categoriza cada transação financeira fornecida em exatamente uma categoria'
};

function formatTransactions(transactions: TransactionToCategorize[]): string {
	return (
		transactions
			// Reais in the prompt, not centavos: the model reasons about "R$ 45,90",
			// and handing it "-4590" would change how it reads magnitude.
			.map(
				(t) => `- id=${t.id} | ${t.date} | ${t.description} | valor=${toReais(t.amount).toFixed(2)}`
			)
			.join('\n')
	);
}

function systemPrompt(
	transactions: TransactionToCategorize[],
	categories: string[],
	customPrompt?: string
): string {
	if (customPrompt) {
		return (
			`${customPrompt}\n\nCategorias válidas: ${categories.join(', ')}.\n\n` +
			`Transações a categorizar:\n${formatTransactions(transactions)}\n\n` +
			`Chame a ferramenta categorize_transactions com um resultado por transação, na mesma quantidade recebida (um id pode não se repetir).`
		);
	}
	return (
		`${DEFAULT_CATEGORIZATION_PROMPT.replace('[categorias do usuário]', categories.join(', '))}\n\n` +
		`Transações a categorizar:\n${formatTransactions(transactions)}\n\n` +
		`Chame a ferramenta categorize_transactions com um resultado por transação, na mesma quantidade recebida (um id pode não se repetir).`
	);
}

export async function categorizeTransactions(
	input: CategorizeInput
): Promise<CategorizedTransaction[]> {
	if (input.transactions.length === 0) return [];

	const batches = chunk(input.transactions, BATCH_SIZE);

	// A single batch keeps the previous behaviour exactly — including throwing on
	// a provider error, which is what the caller relies on to report "the AI call
	// failed" rather than silently leaving everything uncategorised.
	if (batches.length === 1) return categorizeBatch({ ...input, transactions: batches[0] });

	// Several batches: run them one at a time (a Worker has a subrequest budget,
	// and these are large calls) and keep going when one fails. Partial
	// categorisation is strictly better than none — the transactions a failed
	// batch covers stay uncategorised and the next sync retries just those.
	const results: CategorizedTransaction[] = [];
	let failed = 0;
	for (const [index, batch] of batches.entries()) {
		try {
			results.push(...(await categorizeBatch({ ...input, transactions: batch })));
		} catch (err) {
			failed++;
			console.error('[ai/categorize] batch failed', {
				batch: index + 1,
				of: batches.length,
				size: batch.length,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	// Every batch failed — that is the same situation as a single failed call
	// (bad key, no credit, model rejecting the request), so surface it instead of
	// returning an empty list that looks like "the AI had nothing to say".
	if (failed === batches.length) {
		throw new Error(`IA falhou em todos os ${batches.length} lotes de categorização`);
	}
	return results;
}

function categorizeBatch(input: CategorizeInput): Promise<CategorizedTransaction[]> {
	if (input.provider === 'anthropic') return categorizeWithAnthropic(input);
	if (input.provider === 'openai') return categorizeWithOpenAI(input);
	if (input.provider === 'deepseek') return categorizeWithDeepSeek(input);
	throw new Error(`Provider de IA não suportado: ${input.provider}`);
}

async function categorizeWithAnthropic(input: CategorizeInput): Promise<CategorizedTransaction[]> {
	const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': input.apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: input.model,
			max_tokens: maxTokensForBatch(input.transactions.length),
			system: systemPrompt(input.transactions, input.categories, input.customPrompt),
			messages: [{ role: 'user', content: 'Categorize as transações do contexto.' }],
			tools: [
				{
					name: CATEGORIZE_TOOL.name,
					description: CATEGORIZE_TOOL.description,
					input_schema: categorizeSchema(input.categories)
				}
			],
			tool_choice: { type: 'any' }
		})
	});
	if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);

	const data = (await res.json()) as {
		content: Array<{ type: string; name?: string; input?: unknown }>;
		stop_reason?: string;
	};

	// Truncated output means the tool_use payload is incomplete JSON. Say so
	// explicitly instead of letting toResults fail with "formato inesperado",
	// which sends whoever debugs it looking at the schema.
	if (data.stop_reason === 'max_tokens') {
		throw new Error(
			`Resposta da IA truncada (${input.transactions.length} transações no lote) — reduza o lote`
		);
	}

	const toolUse = data.content.find((block) => block.type === 'tool_use');
	if (!toolUse) throw new Error('IA não retornou uma categorização estruturada');
	return toResults(toolUse.input, input.categories);
}

// OpenAI and DeepSeek speak the same chat-completions format — see TAbelhaCal's
// server/ai/parse.ts for the same pattern.
async function categorizeWithOpenAiCompatible(
	input: CategorizeInput,
	apiUrl: string,
	errorLabel: string
): Promise<CategorizedTransaction[]> {
	const res = await fetchWithRetry(apiUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${input.apiKey}`
		},
		body: JSON.stringify({
			model: input.model,
			messages: [
				{
					role: 'system',
					content: systemPrompt(input.transactions, input.categories, input.customPrompt)
				},
				{ role: 'user', content: 'Categorize as transações do contexto.' }
			],
			tools: [
				{
					type: 'function',
					function: {
						name: CATEGORIZE_TOOL.name,
						description: CATEGORIZE_TOOL.description,
						parameters: categorizeSchema(input.categories)
					}
				}
			],
			tool_choice: 'required'
		})
	});
	if (!res.ok) throw new Error(`${errorLabel}: ${res.status} ${await res.text()}`);

	const data = (await res.json()) as {
		choices: Array<{
			message: { tool_calls?: Array<{ function: { name: string; arguments: string } }> };
			finish_reason?: string;
		}>;
	};

	// No explicit max_tokens is sent here on purpose: the batch already bounds the
	// output, and the parameter name differs across models on this API surface
	// (`max_tokens` vs `max_completion_tokens`), so setting it risks a 400 on the
	// newer ones. Truncation is detected after the fact instead.
	if (data.choices[0]?.finish_reason === 'length') {
		throw new Error(
			`Resposta da IA truncada (${input.transactions.length} transações no lote) — reduza o lote`
		);
	}

	const toolCall = data.choices[0]?.message.tool_calls?.[0];
	if (!toolCall) throw new Error('IA não retornou uma categorização estruturada');
	return toResults(JSON.parse(toolCall.function.arguments), input.categories);
}

async function categorizeWithOpenAI(input: CategorizeInput): Promise<CategorizedTransaction[]> {
	return categorizeWithOpenAiCompatible(
		input,
		'https://api.openai.com/v1/chat/completions',
		'OpenAI API error'
	);
}

async function categorizeWithDeepSeek(input: CategorizeInput): Promise<CategorizedTransaction[]> {
	return categorizeWithOpenAiCompatible(
		input,
		'https://api.deepseek.com/chat/completions',
		'DeepSeek API error'
	);
}

function toResults(rawInput: unknown, categories: string[]): CategorizedTransaction[] {
	const parsed = rawInput as { results?: Array<{ id: string; category: string }> };
	if (!parsed.results) throw new Error('IA retornou uma categorização em formato inesperado');
	return parsed.results.filter((r): r is CategorizedTransaction => categories.includes(r.category));
}
