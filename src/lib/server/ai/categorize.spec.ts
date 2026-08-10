import { describe, it, expect, vi, afterEach } from 'vitest';
import { categorizeTransactions, type TransactionToCategorize } from './categorize';

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

const TRANSACTIONS: TransactionToCategorize[] = [
	{ id: 'tx-1', description: 'IFOOD *IFOOD', amount: -45.9, date: '2026-07-15' },
	{ id: 'tx-2', description: 'PIX RECEBIDO', amount: 1200, date: '2026-07-16' }
];

describe('categorizeTransactions', () => {
	it('returns [] without calling fetch when there are no transactions', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const result = await categorizeTransactions({
			provider: 'anthropic',
			model: 'claude-sonnet-5',
			apiKey: 'key',
			categories: ['Alimentação', 'Renda', 'Transferências', 'Investimentos', 'Outros'],
			transactions: []
		});
		expect(result).toEqual([]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('dispatches to Anthropic and parses the tool_use result', async () => {
		const fetchSpy = mockFetchOnce({
			content: [
				{
					type: 'tool_use',
					name: 'categorize_transactions',
					input: {
						results: [
							{ id: 'tx-1', category: 'Alimentação' },
							{ id: 'tx-2', category: 'Transferências' }
						]
					}
				}
			]
		});

		const result = await categorizeTransactions({
			provider: 'anthropic',
			model: 'claude-sonnet-5',
			apiKey: 'anthropic-key',
			categories: ['Alimentação', 'Renda', 'Transferências', 'Investimentos', 'Outros'],
			transactions: TRANSACTIONS
		});

		expect(result).toEqual([
			{ id: 'tx-1', category: 'Alimentação' },
			{ id: 'tx-2', category: 'Transferências' }
		]);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('https://api.anthropic.com/v1/messages');
		expect((init?.headers as Record<string, string>)['x-api-key']).toBe('anthropic-key');
	});

	it('dispatches to OpenAI-compatible chat completions and parses tool_calls', async () => {
		mockFetchOnce({
			choices: [
				{
					message: {
						tool_calls: [
							{
								function: {
									name: 'categorize_transactions',
									arguments: JSON.stringify({
										results: [{ id: 'tx-1', category: 'Alimentação' }]
									})
								}
							}
						]
					}
				}
			]
		});

		const result = await categorizeTransactions({
			provider: 'openai',
			model: 'gpt-5.1',
			apiKey: 'openai-key',
			categories: ['Alimentação', 'Renda', 'Transferências', 'Investimentos', 'Outros'],
			transactions: [TRANSACTIONS[0]]
		});

		expect(result).toEqual([{ id: 'tx-1', category: 'Alimentação' }]);
	});

	it('drops results with a category outside the fixed taxonomy', async () => {
		mockFetchOnce({
			content: [
				{
					type: 'tool_use',
					name: 'categorize_transactions',
					input: {
						results: [
							{ id: 'tx-1', category: 'Categoria Inventada' },
							{ id: 'tx-2', category: 'Renda' }
						]
					}
				}
			]
		});

		const result = await categorizeTransactions({
			provider: 'anthropic',
			model: 'claude-sonnet-5',
			apiKey: 'key',
			categories: ['Alimentação', 'Renda', 'Transferências', 'Investimentos', 'Outros'],
			transactions: TRANSACTIONS
		});

		expect(result).toEqual([{ id: 'tx-2', category: 'Renda' }]);
	});

	it('throws with the provider error message on a non-2xx response', async () => {
		mockFetchOnce({ error: { message: 'invalid api key' } }, false, 401);

		await expect(
			categorizeTransactions({
				provider: 'anthropic',
				model: 'claude-sonnet-5',
				apiKey: 'bad-key',
				categories: ['Alimentação', 'Renda', 'Transferências', 'Investimentos', 'Outros'],
				transactions: TRANSACTIONS
			})
		).rejects.toThrow('Anthropic API error');
	});
});
