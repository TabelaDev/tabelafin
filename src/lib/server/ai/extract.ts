// Structured extraction of transactions from a statement/invoice PDF (ESCOPO.md
// §2.4): the file (base64) goes straight to the user's model API through native
// "document understanding" support (Anthropic's Messages API `document` block;
// OpenAI's Responses API `input_file`) — never a parsing library, which does not
// run in `workerd`. Extraction and categorisation happen in a single request
// (structured tool use), following the same fetch-based dispatch pattern as
// server/ai/categorize.ts.
//
// Providers without `supportsDocuments` (DeepSeek, for one) never reach here: the
// gating happens in the UI and in the upload route before the call. As a
// safeguard, the dispatch still throws if it is called with one of them.
import { fetchWithRetry } from '$lib/server/http';
import type { AiProvider } from '$lib/utils/ai-providers';
import { toCents } from '$lib/utils/money';

// A PDF cannot be split the way a transaction list can (server/ai/categorize.ts
// batches; here the document is the unit), so the only lever is a budget big
// enough for a long invoice: each extracted row costs ~60 tokens, so this covers
// roughly 250 of them. Past that the response is truncated and the user is told
// so — see the checks below. Returning just the rows that fit would be worse:
// parseExtraction drops malformed entries without a word, so a truncated answer
// reads as "your invoice only had 40 transactions".
const MAX_OUTPUT_TOKENS = 16000;

const TRUNCATED_MESSAGE =
	'A resposta da IA foi truncada: o documento tem transações demais para o modelo escolhido. ' +
	'Tente um modelo com saída maior ou envie o extrato dividido por período.';

export interface ExtractedTransaction {
	date: string; // 'YYYY-MM-DD'
	description: string;
	// Integer centavos, negative for expense. The model answers in reais (the
	// schema asks for "valor em reais"), so parseExtraction converts on the way
	// out — this is the boundary.
	amount: number;
	category: string;
}

interface ExtractInput {
	provider: AiProvider;
	model: string;
	apiKey: string;
	// The user's own categories — both the prompt and the schema use this list.
	categories: string[];
	pdfBase64: string;
	fileName: string;
}

function extractSchema(categories: string[]) {
	return {
		type: 'object',
		properties: {
			transactions: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						date: { type: 'string', description: 'Data da transação no formato YYYY-MM-DD' },
						description: { type: 'string', description: 'Descrição como aparece no documento' },
						amount: {
							type: 'number',
							description:
								'Valor em reais com sinal: negativo pra gasto, positivo pra entrada (estorno, reembolso, pagamento recebido)'
						},
						category: { type: 'string', enum: categories }
					},
					required: ['date', 'description', 'amount', 'category']
				},
				description: 'Uma entrada por transação encontrada no documento.'
			}
		},
		required: ['transactions']
	};
}

const EXTRACT_TOOL = {
	name: 'extract_transactions',
	description: 'Extrai e categoriza as transações financeiras listadas no documento PDF'
};

function systemPrompt(categories: string[]): string {
	return (
		`Você extrai transações financeiras de faturas de cartão de crédito e extratos bancários ` +
		`brasileiros (PDF). Extraia TODAS as transações do período (compras, pagamentos, estornos, ` +
		`entradas). Ignore cabeçalhos, rodapés, números de página, valor total da fatura, limite de ` +
		`crédito e qualquer outro resumo que não seja uma transação individual.\n\n` +
		`Regras:\n` +
		`- Data no formato YYYY-MM-DD.\n` +
		`- Valor em reais (BRL), com sinal: negativo pra gasto, positivo pra entrada de dinheiro.\n` +
		`- Categorias válidas: ${categories.join(', ')}.\n` +
		`- Use "Transferências" pra Pix/TED/DOC entre contas do próprio usuário ou pra terceiros sem contexto de compra.\n` +
		`- Use "Investimentos" pra aplicações, resgates e movimentações de corretora.\n` +
		`- Use "Outros" só quando nenhuma categoria específica se aplicar com confiança.`
	);
}

export async function extractTransactionsFromPdf(
	input: ExtractInput
): Promise<ExtractedTransaction[]> {
	if (input.provider === 'anthropic') return extractWithAnthropic(input);
	if (input.provider === 'openai') return extractWithOpenAI(input);
	throw new Error(`O provider ${input.provider} não suporta documentos (upload de PDF).`);
}

async function extractWithAnthropic(input: ExtractInput): Promise<ExtractedTransaction[]> {
	const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': input.apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: input.model,
			max_tokens: MAX_OUTPUT_TOKENS,
			system: systemPrompt(input.categories),
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'document',
							source: { type: 'base64', media_type: 'application/pdf', data: input.pdfBase64 },
							title: input.fileName
						},
						{
							type: 'text',
							text: 'Extraia as transações do documento com a ferramenta extract_transactions.'
						}
					]
				}
			],
			tools: [
				{
					name: EXTRACT_TOOL.name,
					description: EXTRACT_TOOL.description,
					input_schema: extractSchema(input.categories)
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
	if (data.stop_reason === 'max_tokens') throw new Error(TRUNCATED_MESSAGE);

	const toolUse = data.content.find((block) => block.type === 'tool_use');
	if (!toolUse) throw new Error('IA não retornou transações estruturadas do documento');
	return parseExtraction(toolUse.input, input.categories);
}

async function extractWithOpenAI(input: ExtractInput): Promise<ExtractedTransaction[]> {
	const res = await fetchWithRetry('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${input.apiKey}`
		},
		body: JSON.stringify({
			model: input.model,
			// The Responses API spells the budget differently from the Messages API.
			max_output_tokens: MAX_OUTPUT_TOKENS,
			instructions: systemPrompt(input.categories),
			input: [
				{
					role: 'user',
					content: [
						{
							type: 'input_file',
							filename: input.fileName,
							file_data: `data:application/pdf;base64,${input.pdfBase64}`,
							detail: 'high'
						},
						{
							type: 'input_text',
							text: 'Extraia as transações do documento com a ferramenta extract_transactions.'
						}
					]
				}
			],
			tools: [
				{
					type: 'function',
					name: EXTRACT_TOOL.name,
					description: EXTRACT_TOOL.description,
					parameters: extractSchema(input.categories)
				}
			],
			tool_choice: { type: 'function', name: EXTRACT_TOOL.name }
		})
	});
	if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);

	const data = (await res.json()) as {
		output: Array<{ type: string; name?: string; arguments?: string }>;
		status?: string;
		incomplete_details?: { reason?: string };
	};
	if (data.status === 'incomplete' && data.incomplete_details?.reason === 'max_output_tokens') {
		throw new Error(TRUNCATED_MESSAGE);
	}

	const functionCall = data.output.find((item) => item.type === 'function_call');
	if (!functionCall?.arguments)
		throw new Error('IA não retornou transações estruturadas do documento');
	return parseExtraction(JSON.parse(functionCall.arguments), input.categories);
}

// Tolerates noisy entries (an invalid date, an invented category, an empty
// description) by discarding them row by row — one badly formed transaction never
// brings down the whole upload. Currency is not part of the schema: a TAbelhaFin
// statement or invoice is always BRL, written at insert time.
function parseExtraction(rawInput: unknown, categories: string[]): ExtractedTransaction[] {
	const parsed = rawInput as { transactions?: Array<Record<string, unknown>> };
	if (!parsed || !Array.isArray(parsed.transactions)) return [];

	const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
	const result: ExtractedTransaction[] = [];
	for (const raw of parsed.transactions) {
		const date = typeof raw.date === 'string' ? raw.date : '';
		if (!DATE_RE.test(date)) continue;
		const description = typeof raw.description === 'string' ? raw.description.trim() : '';
		if (!description) continue;
		const reais = typeof raw.amount === 'number' ? raw.amount : NaN;
		if (!Number.isFinite(reais)) continue;
		const category = raw.category;
		if (typeof category !== 'string' || !categories.includes(category)) {
			continue;
		}
		// The model answers in reais; centavos from here on.
		result.push({ date, description, amount: toCents(reais), category });
	}
	return result;
}
