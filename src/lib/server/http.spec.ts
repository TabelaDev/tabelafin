import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWithRetry } from './http';

// The backoff really sleeps, so the whole suite runs on fake timers: each test
// kicks the call off, drains the pending timers, then awaits the result.
beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

function response(status: number, headers: Record<string, string> = {}): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: new Headers(headers)
	} as Response;
}

async function settle<T>(promise: Promise<T>): Promise<T> {
	// The handlers are attached synchronously: draining the timers first would
	// let a rejection land while nothing is listening, which Vitest reports as an
	// unhandled rejection even though the test asserts on it.
	const outcome = promise.then(
		(value) => ({ ok: true, value }) as const,
		(error) => ({ ok: false, error }) as const
	);
	await vi.runAllTimersAsync();
	const result = await outcome;
	if (!result.ok) throw result.error;
	return result.value;
}

describe('fetchWithRetry', () => {
	it('returns the first response when it is not retriable', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(200));

		const res = await settle(fetchWithRetry('https://example.test'));

		expect(res.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it('retries once on 429 and returns the retry', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(response(429))
			.mockResolvedValueOnce(response(200));

		const res = await settle(fetchWithRetry('https://example.test', {}, { retries: 1 }));

		expect(res.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it('does not retry a 401 — the same key would just fail again', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(401));

		const res = await settle(fetchWithRetry('https://example.test', {}, { retries: 3 }));

		expect(res.status).toBe(401);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it('gives the last response back when every attempt is retriable', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(503));

		const res = await settle(fetchWithRetry('https://example.test', {}, { retries: 2 }));

		// Returned rather than thrown, so the caller keeps the provider's body in
		// its own error message.
		expect(res.status).toBe(503);
		expect(fetchSpy).toHaveBeenCalledTimes(3);
	});

	it('honours Retry-After, capped at 10s', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(response(429, { 'retry-after': '600' }))
			.mockResolvedValueOnce(response(200));
		const timerSpy = vi.spyOn(globalThis, 'setTimeout');

		await settle(fetchWithRetry('https://example.test', {}, { retries: 1 }));

		// 600s would be honoured verbatim without the ceiling.
		const backoff = timerSpy.mock.calls.map((c) => c[1]).find((ms) => ms === 10_000);
		expect(backoff).toBe(10_000);
	});

	it('falls back to exponential backoff without Retry-After', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(response(429))
			.mockResolvedValueOnce(response(200));
		const timerSpy = vi.spyOn(globalThis, 'setTimeout');

		await settle(fetchWithRetry('https://example.test', {}, { retries: 1 }));

		expect(timerSpy.mock.calls.map((c) => c[1])).toContain(500);
	});

	it('passes an abort signal so a stalled provider cannot pin the Worker', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(200));

		await settle(fetchWithRetry('https://example.test', { method: 'POST' }));

		const init = fetchSpy.mock.calls[0][1];
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		expect(init?.method).toBe('POST');
	});

	it('rethrows the original network error after exhausting the retries', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection reset'));

		await expect(
			settle(fetchWithRetry('https://example.test', {}, { retries: 1 }))
		).rejects.toThrow('connection reset');
	});
});
