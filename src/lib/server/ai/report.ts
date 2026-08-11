// The monthly report's narrative (ESCOPO.md §3.6) — the same three-provider
// fetch-based dispatch as server/ai/categorize.ts and TabelaCal's
// server/ai/parse.ts, but without tool use: the output here is free text (a short
// paragraph), not structured data, so a plain completion call is enough.
import type { AiProvider } from '$lib/ai-providers';

export interface CategoryTotals {
	[category: string]: number;
}

export interface MonthlyReportInput {
	provider: AiProvider;
	model: string;
	apiKey: string;
	yearMonth: string; // 'YYYY-MM'
	totalIncome: number;
	totalExpense: number;
	categoryTotals: CategoryTotals;
	investmentBalance: number;
	previousMonth?: { totalExpense: number; categoryTotals: CategoryTotals } | null;
}

function formatCurrency(value: number): string {
	return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCategoryTotals(totals: CategoryTotals): string {
	const entries = Object.entries(totals).sort(([, a], [, b]) => b - a);
	if (entries.length === 0) return 'nenhum gasto categorizado';
	return entries.map(([category, amount]) => `${category}: ${formatCurrency(amount)}`).join(', ');
}

function buildPrompt(input: MonthlyReportInput): string {
	const previousLine = input.previousMonth
		? `Mês anterior, pra comparação: gasto total ${formatCurrency(input.previousMonth.totalExpense)}, por categoria: ${formatCategoryTotals(input.previousMonth.categoryTotals)}.`
		: 'Não há dados do mês anterior pra comparar (primeiro relatório do usuário).';

	return (
		`Escreva um parágrafo curto (3-5 frases, em português do Brasil, tom direto e prático, ` +
		`sem saudação nem despedida) resumindo as finanças pessoais do mês ${input.yearMonth} do ` +
		`usuário e apontando 1-2 sugestões concretas de onde ele poderia economizar, com base nestes dados:\n\n` +
		`Renda total: ${formatCurrency(input.totalIncome)}.\n` +
		`Gasto total: ${formatCurrency(input.totalExpense)}.\n` +
		`Gasto por categoria: ${formatCategoryTotals(input.categoryTotals)}.\n` +
		`Saldo atual em investimentos: ${formatCurrency(input.investmentBalance)}.\n` +
		`${previousLine}`
	);
}

export async function generateMonthlySummary(input: MonthlyReportInput): Promise<string> {
	if (input.provider === 'anthropic') return generateWithAnthropic(input);
	if (input.provider === 'openai') {
		return generateWithOpenAiCompatible(
			input,
			'https://api.openai.com/v1/chat/completions',
			'OpenAI API error'
		);
	}
	if (input.provider === 'deepseek') {
		return generateWithOpenAiCompatible(
			input,
			'https://api.deepseek.com/chat/completions',
			'DeepSeek API error'
		);
	}
	throw new Error(`Provider de IA não suportado: ${input.provider}`);
}

async function generateWithAnthropic(input: MonthlyReportInput): Promise<string> {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': input.apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: input.model,
			max_tokens: 512,
			messages: [{ role: 'user', content: buildPrompt(input) }]
		})
	});
	if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);

	const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
	const textBlock = data.content.find((block) => block.type === 'text');
	if (!textBlock?.text) throw new Error('IA não retornou um resumo em texto');
	return textBlock.text.trim();
}

async function generateWithOpenAiCompatible(
	input: MonthlyReportInput,
	apiUrl: string,
	errorLabel: string
): Promise<string> {
	const res = await fetch(apiUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${input.apiKey}`
		},
		body: JSON.stringify({
			model: input.model,
			messages: [{ role: 'user', content: buildPrompt(input) }]
		})
	});
	if (!res.ok) throw new Error(`${errorLabel}: ${res.status} ${await res.text()}`);

	const data = (await res.json()) as { choices: Array<{ message: { content?: string } }> };
	const content = data.choices[0]?.message.content;
	if (!content) throw new Error('IA não retornou um resumo em texto');
	return content.trim();
}
