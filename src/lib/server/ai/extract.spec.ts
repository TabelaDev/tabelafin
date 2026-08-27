import { afterEach, describe, expect, it, vi } from 'vitest';

import { extractTransactionsFromPdf } from './extract';

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
	model: 'claude-sonnet-5',
	apiKey: 'key',
	categories: ['Alimentação', 'Transferências', 'Investimentos', 'Outros', 'Compras'],
	pdfBase64: 'JVBERi0xLjQ=',
	fileName: 'fatura.pdf'
};

const EXTRACTED = {
	transactions: [
		{ date: '2026-07-15', description: 'IFOOD *IFOOD', amount: -45.9, category: 'Alimentação' },
		{ date: '2026-07-16', description: 'PIX RECEBIDO', amount: 1200, category: 'Transferências' }
	]
};

describe('extractTransactionsFromPdf', () => {
	it('dispatches to Anthropic with a document block and parses the tool_use result', async () => {
		const fetchSpy = mockFetchOnce({
			content: [{ type: 'tool_use', name: 'extract_transactions', input: EXTRACTED }]
		});

		const result = await extractTransactionsFromPdf({
			...BASE_INPUT,
			provider: 'anthropic',
			apiKey: 'anthropic-key'
		});

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			date: '2026-07-15',
			description: 'IFOOD *IFOOD',
			// The model answers in reais; parseExtraction converts to centavos.
			amount: -4590,
			category: 'Alimentação'
		});

		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('https://api.anthropic.com/v1/messages');
		expect((init?.headers as Record<string, string>)['x-api-key']).toBe('anthropic-key');

		const body = JSON.parse((init?.body as string) ?? '{}');
		const docBlock = body.messages[0].content[0];
		expect(docBlock.type).toBe('document');
		expect(docBlock.source).toEqual({
			type: 'base64',
			media_type: 'application/pdf',
			data: BASE_INPUT.pdfBase64
		});
		expect(body.tools[0].name).toBe('extract_transactions');
		expect(body.tool_choice).toEqual({ type: 'any' });
	});

	it('dispatches to OpenAI Responses API with an input_file and parses the function_call', async () => {
		const fetchSpy = mockFetchOnce({
			output: [
				{
					type: 'function_call',
					name: 'extract_transactions',
					arguments: JSON.stringify(EXTRACTED)
				}
			]
		});

		const result = await extractTransactionsFromPdf({
			...BASE_INPUT,
			provider: 'openai',
			model: 'gpt-5.1',
			apiKey: 'openai-key'
		});

		expect(result).toHaveLength(2);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('https://api.openai.com/v1/responses');
		expect((init?.headers as Record<string, string>).authorization).toBe('Bearer openai-key');

		const body = JSON.parse((init?.body as string) ?? '{}');
		const fileBlock = body.input[0].content[0];
		expect(fileBlock.type).toBe('input_file');
		expect(fileBlock.file_data).toBe(`data:application/pdf;base64,${BASE_INPUT.pdfBase64}`);
		expect(body.tool_choice).toEqual({ type: 'function', name: 'extract_transactions' });
	});

	it('drops malformed rows instead of failing the whole upload', async () => {
		mockFetchOnce({
			content: [
				{
					type: 'tool_use',
					name: 'extract_transactions',
					input: {
						transactions: [
							{ date: '15/07/2026', description: 'data errada', amount: -10, category: 'Outros' },
							{ date: '2026-07-10', description: '', amount: -20, category: 'Outros' },
							{
								date: '2026-07-11',
								description: 'não numérico',
								amount: 'dez',
								category: 'Outros'
							},
							{
								date: '2026-07-12',
								description: 'categoria inventada',
								amount: -30,
								category: 'Nebulosa'
							},
							{ date: '2026-07-13', description: 'OK', amount: -50, category: 'Compras' }
						]
					}
				}
			]
		});

		const result = await extractTransactionsFromPdf({ ...BASE_INPUT, provider: 'anthropic' });

		expect(result).toEqual([
			{ date: '2026-07-13', description: 'OK', amount: -5000, category: 'Compras' }
		]);
	});

	it('throws when a provider without document support is dispatched', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await expect(
			extractTransactionsFromPdf({
				...BASE_INPUT,
				provider: 'deepseek',
				model: 'deepseek-v4-flash'
			})
		).rejects.toThrow('não suporta documentos');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('throws with the provider error message on a non-2xx response', async () => {
		mockFetchOnce({ error: { message: 'file too large' } }, false, 413);

		await expect(
			extractTransactionsFromPdf({ ...BASE_INPUT, provider: 'anthropic', apiKey: 'bad-key' })
		).rejects.toThrow('Anthropic API error');
	});
});
