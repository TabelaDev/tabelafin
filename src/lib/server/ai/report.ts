// The monthly report's narrative (ESCOPO.md §3.6) — the same three-provider
// fetch-based dispatch as server/ai/categorize.ts and TAbelhaCal's
// server/ai/parse.ts, but without tool use: the output here is free text (a short
// paragraph), not structured data, so a plain completion call is enough.
import { DEFAULT_REPORT_INSTRUCTION } from '$lib/prompts';
import { fetchWithRetry } from '$lib/server/http';
import type { AiProvider } from '$lib/utils/ai-providers';
import { toReais } from '$lib/utils/money';

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
	/** One-off groupings (tags) — included so the AI can mention them. */
	tagTotals?: Array<{ name: string; expense: number }>;
}

// Takes integer centavos, like every other money value in the app, and renders
// reais for the prompt — the model reasons about "R$ 45,90", not "4590".
function formatCurrency(cents: number): string {
	return toReais(cents).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCategoryTotals(totals: CategoryTotals): string {
	const entries = Object.entries(totals).sort(([, a], [, b]) => b - a);
	if (entries.length === 0) return 'nenhum gasto categorizado';
	return entries.map(([category, amount]) => `${category}: ${formatCurrency(amount)}`).join(', ');
}

function formatTagTotals(tags: Array<{ name: string; expense: number }>): string {
	const withSpend = tags.filter((t) => t.expense !== 0).sort((a, b) => b.expense - a.expense);
	if (withSpend.length === 0) return 'nenhuma tag com gasto';
	return withSpend.map((t) => `${t.name}: ${formatCurrency(t.expense)}`).join(', ');
}

function buildPrompt(input: MonthlyReportInput): string {
	const previousLine = input.previousMonth
		? `Mês anterior, pra comparação: gasto total ${formatCurrency(input.previousMonth.totalExpense)}, por categoria: ${formatCategoryTotals(input.previousMonth.categoryTotals)}.`
		: 'Não há dados do mês anterior pra comparar (primeiro relatório do usuário).';

	const tagLine = input.tagTotals
		? `\nGasto por tag (agrupamentos pontuais, ex.: viagem): ${formatTagTotals(input.tagTotals)}.`
		: '';

	return (
		`${DEFAULT_REPORT_INSTRUCTION} ${input.yearMonth} do ` +
		`usuário e apontando 1-2 sugestões concretas de onde ele poderia economizar, com base nestes dados:\n\n` +
		`Renda total: ${formatCurrency(input.totalIncome)}.\n` +
		`Gasto total: ${formatCurrency(input.totalExpense)}.\n` +
		`Gasto por categoria: ${formatCategoryTotals(input.categoryTotals)}.\n` +
		`Saldo atual em investimentos: ${formatCurrency(input.investmentBalance)}.\n` +
		`${previousLine}${tagLine}`
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
	const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
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
	const res = await fetchWithRetry(apiUrl, {
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
