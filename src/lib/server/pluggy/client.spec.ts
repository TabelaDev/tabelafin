import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAccounts, fetchInvestments, fetchItems, fetchTransactions } from './client';

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

const TOKEN = 'test-jwt-token';

describe('fetchItems', () => {
	it('fetches items from my-api.pluggy.ai with JWT auth', async () => {
		const fetchSpy = mockFetchOnce([
			{
				id: 'item-1',
				connector: { name: 'Nubank', type: 'PERSONAL_BANK' },
				status: 'UPDATED'
			}
		]);

		const items = await fetchItems(TOKEN);

		expect(items).toEqual([
			{
				id: 'item-1',
				institutionName: 'Nubank',
				institutionType: 'PERSONAL_BANK',
				status: 'updated'
			}
		]);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(String(url)).toContain('my-api.pluggy.ai/items');
		expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
	});

	it('throws on non-2xx response', async () => {
		mockFetchOnce({ message: 'Unauthorized' }, false, 401);

		await expect(fetchItems('bad-token')).rejects.toThrow('My Pluggy API error');
	});
});

describe('fetchAccounts', () => {
	it('fetches accounts for multiple items', async () => {
		const fetchSpy = mockFetchOnce([
			{ id: 'acc-1', type: 'BANK', name: 'Conta Corrente', currencyCode: 'BRL', balance: 100 },
			{
				id: 'acc-2',
				type: 'CREDIT',
				subtype: 'CREDIT_CARD',
				name: 'Cartão',
				currencyCode: 'BRL',
				balance: 200
			}
		]);

		const accounts = await fetchAccounts(TOKEN, ['item-1', 'item-2']);

		expect(accounts).toEqual([
			// The API answers in reais; the client converts to centavos at this
			// boundary, so everything downstream is integers.
			{ id: 'acc-1', type: 'checking', name: 'Conta Corrente', currency: 'BRL', balance: 10000 },
			{ id: 'acc-2', type: 'credit_card', name: 'Cartão', currency: 'BRL', balance: 20000 }
		]);
		const [url] = fetchSpy.mock.calls[0];
		expect(String(url)).toContain('itemId=item-1');
		expect(String(url)).toContain('itemId=item-2');
	});
});

describe('fetchTransactions', () => {
	it('fetches transactions for multiple accounts', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => [
					{
						id: 'tx-1',
						description: 'Padaria',
						amount: -15.5,
						date: '2026-07-30T00:00:00.000Z',
						currencyCode: 'BRL'
					}
				]
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => [
					{
						id: 'tx-2',
						description: 'Farmácia',
						amount: -42,
						date: '2026-07-31T00:00:00.000Z',
						currencyCode: 'BRL'
					}
				]
			} as Response);

		const transactions = await fetchTransactions(TOKEN, ['acc-1', 'acc-2']);

		expect(transactions).toEqual([
			{
				id: 'tx-1',
				description: 'Padaria',
				// reais in, centavos out — this is the conversion boundary.
				amount: -1550,
				date: '2026-07-30T00:00:00.000Z',
				currency: 'BRL',
				category: null
			},
			{
				id: 'tx-2',
				description: 'Farmácia',
				amount: -4200,
				date: '2026-07-31T00:00:00.000Z',
				currency: 'BRL',
				category: null
			}
		]);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});
});

describe('fetchInvestments', () => {
	it('fetches investments for multiple items', async () => {
		const fetchSpy = mockFetchOnce([
			{ id: 'inv-1', name: 'Renda Fixa', balance: 1000, currencyCode: 'BRL' }
		]);

		const investments = await fetchInvestments(TOKEN, ['item-1']);

		expect(investments).toEqual([
			{ id: 'inv-1', name: 'Renda Fixa', balance: 100000, currency: 'BRL' }
		]);
		const [url] = fetchSpy.mock.calls[0];
		expect(String(url)).toContain('itemId=item-1');
	});
});
