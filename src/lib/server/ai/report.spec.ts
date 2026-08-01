import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateMonthlySummary } from './report';

function mockFetchOnce(body: unknown, ok = true, status = ok ? 200 : 500) {
	return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
		ok,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body)
	} as Response);
}

afterEach(() => {
	vi.restoreAllMocks();
});

const BASE_INPUT = {
	yearMonth: '2026-07',
	totalIncome: 5000,
	totalExpense: 3200,
	categoryTotals: { Alimentação: 800, Transporte: 400 },
	investmentBalance: 12000,
	previousMonth: null
};

describe('generateMonthlySummary', () => {
	it('dispatches to Anthropic and returns the text block', async () => {
		const fetchSpy = mockFetchOnce({
			content: [{ type: 'text', text: '  Resumo do mês.  ' }]
		});

		const summary = await generateMonthlySummary({
			...BASE_INPUT,
			provider: 'anthropic',
			model: 'claude-sonnet-5',
			apiKey: 'anthropic-key'
		});

		expect(summary).toBe('Resumo do mês.');
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('https://api.anthropic.com/v1/messages');
		expect((init?.headers as Record<string, string>)['x-api-key']).toBe('anthropic-key');
	});

	it('dispatches to OpenAI-compatible chat completions and returns message content', async () => {
		mockFetchOnce({ choices: [{ message: { content: 'Resumo via OpenAI.' } }] });

		const summary = await generateMonthlySummary({
			...BASE_INPUT,
			provider: 'openai',
			model: 'gpt-5.1',
			apiKey: 'openai-key'
		});

		expect(summary).toBe('Resumo via OpenAI.');
	});

	it('throws with the provider error message on a non-2xx response', async () => {
		mockFetchOnce({ error: 'boom' }, false, 500);

		await expect(
			generateMonthlySummary({
				...BASE_INPUT,
				provider: 'anthropic',
				model: 'claude-sonnet-5',
				apiKey: 'bad-key'
			})
		).rejects.toThrow('Anthropic API error');
	});
});
