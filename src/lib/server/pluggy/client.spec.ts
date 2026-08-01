import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	getApiKey,
	createConnectToken,
	fetchItem,
	fetchAccounts,
	fetchTransactions
} from './client';

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

describe('getApiKey', () => {
	it('posts clientId/clientSecret to /auth and returns the apiKey', async () => {
		const fetchSpy = mockFetchOnce({ apiKey: 'api-key-123' });

		const apiKey = await getApiKey('client-1', 'secret-1');

		expect(apiKey).toBe('api-key-123');
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('https://api.pluggy.ai/auth');
		expect(init?.method).toBe('POST');
		expect(JSON.parse(String(init?.body))).toEqual({
			clientId: 'client-1',
			clientSecret: 'secret-1'
		});
	});

	it('throws with the Pluggy error message on a non-2xx response', async () => {
		mockFetchOnce({ code: 401, message: 'Client keys are invalid' }, false, 401);

		await expect(getApiKey('client-1', 'secret-1')).rejects.toThrow('Client keys are invalid');
	});
});

describe('createConnectToken', () => {
	it('sends the apiKey as X-API-KEY and returns the accessToken', async () => {
		const fetchSpy = mockFetchOnce({ accessToken: 'connect-token-abc' });

		const token = await createConnectToken('api-key-123');

		expect(token).toBe('connect-token-abc');
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('https://api.pluggy.ai/connect_token');
		expect((init?.headers as Record<string, string>)['X-API-KEY']).toBe('api-key-123');
	});

	it('includes itemId in the body when updating an existing item', async () => {
		const fetchSpy = mockFetchOnce({ accessToken: 'connect-token-abc' });

		await createConnectToken('api-key-123', { itemId: 'item-1' });

		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual({ itemId: 'item-1' });
	});
});

describe('fetchItem', () => {
	it('maps connector name/type and lowercases the status', async () => {
		mockFetchOnce({
			id: 'item-1',
			status: 'UPDATED',
			connector: { name: 'Nubank', type: 'PERSONAL_BANK' }
		});

		const item = await fetchItem('api-key-123', 'item-1');

		expect(item).toEqual({
			id: 'item-1',
			institutionName: 'Nubank',
			institutionType: 'PERSONAL_BANK',
			status: 'updated'
		});
	});
});

describe('fetchAccounts', () => {
	it('maps type BANK/CREDIT to checking/credit_card and follows pagination', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					page: 1,
					totalPages: 2,
					results: [
						{ id: 'acc-1', type: 'BANK', name: 'Conta Corrente', currencyCode: 'BRL', balance: 100 }
					]
				})
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					page: 2,
					totalPages: 2,
					results: [
						{ id: 'acc-2', type: 'CREDIT', name: 'Cartão', currencyCode: 'BRL', balance: 200 }
					]
				})
			} as Response);

		const accounts = await fetchAccounts('api-key-123', 'item-1');

		expect(accounts).toEqual([
			{ id: 'acc-1', type: 'checking', name: 'Conta Corrente', currency: 'BRL', balance: 100 },
			{ id: 'acc-2', type: 'credit_card', name: 'Cartão', currency: 'BRL', balance: 200 }
		]);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});
});

describe('fetchTransactions', () => {
	it('drops the Pluggy category field and forwards from/to as query params', async () => {
		const fetchSpy = mockFetchOnce({
			page: 1,
			totalPages: 1,
			results: [
				{
					id: 'tx-1',
					description: 'Padaria',
					amount: -15.5,
					date: '2026-07-30T00:00:00.000Z',
					category: 'Food',
					currencyCode: 'BRL'
				}
			]
		});

		const transactions = await fetchTransactions('api-key-123', 'acc-1', {
			from: '2026-06-26',
			to: '2026-07-31'
		});

		expect(transactions).toEqual([
			{
				id: 'tx-1',
				description: 'Padaria',
				amount: -15.5,
				date: '2026-07-30T00:00:00.000Z',
				currency: 'BRL'
			}
		]);
		const [url] = fetchSpy.mock.calls[0];
		expect(String(url)).toContain('accountId=acc-1');
		expect(String(url)).toContain('from=2026-06-26');
		expect(String(url)).toContain('to=2026-07-31');
	});
});
