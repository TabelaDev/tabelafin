// Extração estruturada de transações de um PDF de fatura/extrato (ESCOPO.md
// §2.4): o arquivo (base64) é enviado direto pra API do modelo do usuário via
// suporte nativo de "document understanding" (bloco `document` da Messages API
// da Anthropic; `input_file` da Responses API da OpenAI) — nunca lib de
// parsing, que não roda em `workerd`. Extração + categorização acontecem num
// único request (tool-use estruturado), seguindo o mesmo padrão de dispatch
// fetch-based de server/ai/categorize.ts.
//
// Providers sem `supportsDocuments` (ex.: DeepSeek) não chegam aqui: o gating
// é feito na UI e na rota de upload antes da chamada. Por defesa, o dispatch
// ainda lança erro se for chamado com um desses providers.
import type { AiProvider } from '$lib/ai-providers';

export interface ExtractedTransaction {
	date: string; // 'YYYY-MM-DD'
	description: string;
	amount: number; // negativo pra gasto, positivo pra entrada
	category: string;
}

interface ExtractInput {
	provider: AiProvider;
	model: string;
	apiKey: string;
	// Categorias do usuário (dinâmicas) — prompt e schema usam essa lista.
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
	};
	const toolUse = data.content.find((block) => block.type === 'tool_use');
	if (!toolUse) throw new Error('IA não retornou transações estruturadas do documento');
	return parseExtraction(toolUse.input, input.categories);
}

async function extractWithOpenAI(input: ExtractInput): Promise<ExtractedTransaction[]> {
	const res = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${input.apiKey}`
		},
		body: JSON.stringify({
			model: input.model,
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
	};
	const functionCall = data.output.find((item) => item.type === 'function_call');
	if (!functionCall?.arguments)
		throw new Error('IA não retornou transações estruturadas do documento');
	return parseExtraction(JSON.parse(functionCall.arguments), input.categories);
}

// Aceita entradas com ruído (data inválida, categoria inventada, descrição
// vazia) descartando linha por linha — nunca derruba o upload inteiro por uma
// transação mal formatada. A moeda não entra no schema: fatura/extrato do
// TabelaFin é sempre BRL, gravado no insert.
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
		const amount = typeof raw.amount === 'number' ? raw.amount : NaN;
		if (!Number.isFinite(amount)) continue;
		const category = raw.category;
		if (typeof category !== 'string' || !categories.includes(category)) {
			continue;
		}
		result.push({ date, description, amount, category });
	}
	return result;
}
