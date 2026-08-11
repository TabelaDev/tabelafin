// Categorização em lote via IA (ESCOPO.md §3.3): uma chamada por sync/upload
// cobrindo todas as transações novas de uma vez — nunca uma chamada por
// transação, nunca recorrente a cada view do dashboard. Mesmo padrão de
// dispatch fetch-based (Anthropic/OpenAI/DeepSeek) do TabelaCal
// (server/ai/parse.ts): sem SDK, só fetch(), pra rodar em `workerd`.
import type { AiProvider } from '$lib/ai-providers';

export interface TransactionToCategorize {
	id: string;
	description: string;
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
	// Categorias do usuário (dinâmicas) — o prompt e o schema de tool calling
	// usam essa lista, não uma taxonomia fixa.
	categories: string[];
	// Prompt customizado do usuário (ver /profile/ai) — sobrescreve o system
	// prompt default quando presente.
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
	return transactions
		.map((t) => `- id=${t.id} | ${t.date} | ${t.description} | valor=${t.amount.toFixed(2)}`)
		.join('\n');
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
		`Você categoriza transações financeiras pessoais (Brasil). Categorias válidas: ` +
		`${categories.join(', ')}.\n\n` +
		`Regras:\n` +
		`- Valores negativos costumam ser gastos, positivos costumam ser entrada de dinheiro (ex: "Renda" ou "Transferências").\n` +
		`- Use "Transferências" pra Pix/TED/DOC entre contas do próprio usuário ou pra terceiros sem contexto de compra.\n` +
		`- Use "Investimentos" pra aplicações, resgates e movimentações de corretora.\n` +
		`- Use "Outros" só quando nenhuma categoria específica se aplicar com confiança.\n\n` +
		`Transações a categorizar:\n${formatTransactions(transactions)}\n\n` +
		`Chame a ferramenta categorize_transactions com um resultado por transação, na mesma quantidade recebida (um id pode não se repetir).`
	);
}

export async function categorizeTransactions(
	input: CategorizeInput
): Promise<CategorizedTransaction[]> {
	if (input.transactions.length === 0) return [];
	if (input.provider === 'anthropic') return categorizeWithAnthropic(input);
	if (input.provider === 'openai') return categorizeWithOpenAI(input);
	if (input.provider === 'deepseek') return categorizeWithDeepSeek(input);
	throw new Error(`Provider de IA não suportado: ${input.provider}`);
}

async function categorizeWithAnthropic(input: CategorizeInput): Promise<CategorizedTransaction[]> {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': input.apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: input.model,
			max_tokens: 4096,
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
	};
	const toolUse = data.content.find((block) => block.type === 'tool_use');
	if (!toolUse) throw new Error('IA não retornou uma categorização estruturada');
	return toResults(toolUse.input, input.categories);
}

// OpenAI e DeepSeek falam o mesmo formato de chat completions — ver
// server/ai/parse.ts do TabelaCal pro mesmo padrão.
async function categorizeWithOpenAiCompatible(
	input: CategorizeInput,
	apiUrl: string,
	errorLabel: string
): Promise<CategorizedTransaction[]> {
	const res = await fetch(apiUrl, {
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
		}>;
	};
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
