import { afterEach, describe, expect, it, vi } from 'vitest';

import { type TransactionToCategorize, categorizeTransactions } from './categorize';

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

	it('reports a truncated Anthropic response instead of a parsing error', async () => {
		mockFetchOnce({ content: [], stop_reason: 'max_tokens' });

		await expect(
			categorizeTransactions({
				provider: 'anthropic',
				model: 'claude-sonnet-5',
				apiKey: 'key',
				categories: ['Alimentação', 'Renda', 'Transferências', 'Investimentos', 'Outros'],
				transactions: TRANSACTIONS
			})
		).rejects.toThrow('truncada');
	});

	it('scales max_tokens with the batch size', async () => {
		const fetchSpy = mockFetchOnce({
			content: [{ type: 'tool_use', name: 'categorize_transactions', input: { results: [] } }]
		});

		await categorizeTransactions({
			provider: 'anthropic',
			model: 'claude-sonnet-5',
			apiKey: 'key',
			categories: ['Alimentação'],
			transactions: TRANSACTIONS
		});

		const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
		expect(body.max_tokens).toBe(512 + 2 * 48);
	});
});

// The regression this guards: a first sync of a real account produces far more
// transactions than one call can answer, and the old single-call path lost
// every result when the response got truncated.
describe('categorizeTransactions — batching', () => {
	function manyTransactions(count: number): TransactionToCategorize[] {
		return Array.from({ length: count }, (_, i) => ({
			id: `tx-${i}`,
			description: `COMPRA ${i}`,
			amount: -10,
			date: '2026-07-15'
		}));
	}

	function anthropicOk(ids: string[]) {
		return {
			content: [
				{
					type: 'tool_use',
					name: 'categorize_transactions',
					input: { results: ids.map((id) => ({ id, category: 'Alimentação' })) }
				}
			]
		};
	}

	it('splits a large run into batches of 100 and merges the results', async () => {
		const transactions = manyTransactions(250);
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((async (
			_url: string,
			init: RequestInit
		) => {
			const body = JSON.parse(init.body as string);
			// The ids in this batch come from the prompt the caller just built.
			const ids = [...(body.system as string).matchAll(/id=(tx-\d+)/g)].map((m) => m[1]);
			return {
				ok: true,
				status: 200,
				json: async () => anthropicOk(ids),
				text: async () => ''
			} as Response;
		}) as unknown as typeof fetch);

		const result = await categorizeTransactions({
			provider: 'anthropic',
			model: 'claude-sonnet-5',
			apiKey: 'key',
			categories: ['Alimentação'],
			transactions
		});

		expect(fetchSpy).toHaveBeenCalledTimes(3); // 100 + 100 + 50
		expect(result).toHaveLength(250);
		expect(result.map((r) => r.id)).toEqual(transactions.map((t) => t.id));
	});

	it('keeps the results of the batches that succeeded when one fails', async () => {
		let call = 0;
		vi.spyOn(globalThis, 'fetch').mockImplementation((async (_url: string, init: RequestInit) => {
			call++;
			// 400, not 429: a retriable status would be retried by fetchWithRetry
			// and this test is about a batch that genuinely fails.
			if (call === 2) {
				return { ok: false, status: 400, text: async () => 'bad request' } as Response;
			}
			const body = JSON.parse(init.body as string);
			const ids = [...(body.system as string).matchAll(/id=(tx-\d+)/g)].map((m) => m[1]);
			return {
				ok: true,
				status: 200,
				json: async () => anthropicOk(ids),
				text: async () => ''
			} as Response;
		}) as unknown as typeof fetch);

		const result = await categorizeTransactions({
			provider: 'anthropic',
			model: 'claude-sonnet-5',
			apiKey: 'key',
			categories: ['Alimentação'],
			transactions: manyTransactions(250)
		});

		// The middle batch is lost, the other two survive — the next sync retries
		// only the 100 that stayed uncategorised.
		expect(result).toHaveLength(150);
	});

	it('throws when every batch fails, instead of returning an empty list', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: false,
			status: 401,
			text: async () => 'invalid api key'
		} as Response);

		await expect(
			categorizeTransactions({
				provider: 'anthropic',
				model: 'claude-sonnet-5',
				apiKey: 'bad-key',
				categories: ['Alimentação'],
				transactions: manyTransactions(250)
			})
		).rejects.toThrow('todos os 3 lotes');
	});
});
