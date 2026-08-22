import { describe, it, expect } from 'vitest';
import {
	checkRateLimit,
	clientRateLimitKey,
	rateLimitMessage,
	SIGN_IN_RULE,
	SIGN_UP_RULE
} from './rate-limit';

// Minimal in-memory stand-in for the KV binding: only get/put with JSON are
// used, and TTL expiry is modelled by advancing `now` instead of waiting.
function fakeKv() {
	const store = new Map<string, string>();
	return {
		store,
		get: async (key: string) => {
			const raw = store.get(key);
			return raw ? JSON.parse(raw) : null;
		},
		put: async (key: string, value: string) => {
			store.set(key, value);
		}
	} as unknown as KVNamespace;
}

const RULE = { limit: 3, windowSeconds: 600 };
const T0 = new Date('2026-08-16T12:00:00Z').getTime();

describe('checkRateLimit', () => {
	it('allows attempts up to the limit and reports the remaining budget', async () => {
		const kv = fakeKv();
		const results = [];
		for (let i = 0; i < 3; i++) {
			results.push(await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, T0));
		}
		expect(results.map((r) => r.allowed)).toEqual([true, true, true]);
		expect(results.map((r) => r.remaining)).toEqual([2, 1, 0]);
	});

	// The regression this file exists for: before this, POST /login bypassed
	// Better Auth's router middleware entirely, so password guessing was
	// unbounded.
	it('blocks the attempt after the limit', async () => {
		const kv = fakeKv();
		for (let i = 0; i < 3; i++) await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, T0);

		const blocked = await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, T0);
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
		expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
	});

	it('starts a fresh window once the old one elapsed', async () => {
		const kv = fakeKv();
		for (let i = 0; i < 3; i++) await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, T0);

		const later = T0 + RULE.windowSeconds * 1000 + 1;
		const allowed = await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, later);
		expect(allowed.allowed).toBe(true);
		expect(allowed.remaining).toBe(2);
	});

	it('counts each address separately', async () => {
		const kv = fakeKv();
		for (let i = 0; i < 3; i++) await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, T0);

		const other = await checkRateLimit(kv, 'signin', '5.6.7.8', RULE, T0);
		expect(other.allowed).toBe(true);
	});

	it('counts each scope separately', async () => {
		const kv = fakeKv();
		for (let i = 0; i < 3; i++) await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, T0);

		const signup = await checkRateLimit(kv, 'signup', '1.2.3.4', RULE, T0);
		expect(signup.allowed).toBe(true);
	});

	it('counts down the retry window as it elapses', async () => {
		const kv = fakeKv();
		for (let i = 0; i < 3; i++) await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, T0);

		const early = await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, T0 + 1000);
		const late = await checkRateLimit(kv, 'signin', '1.2.3.4', RULE, T0 + 500_000);
		expect(late.retryAfterSeconds).toBeLessThan(early.retryAfterSeconds);
	});
});

describe('clientRateLimitKey', () => {
	it('uses the Cloudflare-set client address', () => {
		const request = new Request('https://example.test', {
			headers: { 'CF-Connecting-IP': '203.0.113.7' }
		});
		expect(clientRateLimitKey(request)).toBe('203.0.113.7');
	});

	// X-Forwarded-For is client-settable, so trusting it would let an attacker
	// mint a fresh bucket per attempt.
	it('generates a random key when CF-Connecting-IP is absent', () => {
		const request = new Request('https://example.test', {
			headers: { 'X-Forwarded-For': '9.9.9.9' }
		});
		const key = clientRateLimitKey(request);
		// Should be a UUID, not 'unknown' or the spoofed X-Forwarded-For
		expect(key).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
	});

	it('scopes by the suffix when one is given, case-insensitively', () => {
		const request = new Request('https://example.test', {
			headers: { 'CF-Connecting-IP': '203.0.113.7' }
		});
		expect(clientRateLimitKey(request, 'Ian@Example.COM')).toBe('203.0.113.7:ian@example.com');
	});
});

describe('rateLimitMessage', () => {
	it('says minutes when the wait is longer than one', () => {
		expect(rateLimitMessage(600)).toContain('10 minutos');
	});

	it('says roughly a minute for a short wait', () => {
		expect(rateLimitMessage(30)).toContain('1 minuto');
	});
});

describe('the shipped rules', () => {
	// This assertion used to read `SIGN_IN_RULE.limit > 0`, which cannot fail and
	// says nothing about the property the test name claims. It now compares the
	// two rules, which is the invariant that actually matters: sign-up is the
	// more expensive event — every account created is then iterated by both crons
	// on every run — so its budget must be the stricter one. "Stricter" is
	// attempts per unit of time, not the raw count, since the windows differ.
	it('limits sign-up more tightly than sign-in', () => {
		const perMinute = (rule: { limit: number; windowSeconds: number }) =>
			rule.limit / (rule.windowSeconds / 60);

		expect(perMinute(SIGN_UP_RULE)).toBeLessThan(perMinute(SIGN_IN_RULE));
	});

	// Both windows have to be at least KV's minimum TTL, or `expirationTtl`
	// silently outlives the window and an address stays blocked past its reset.
	it('uses windows KV can actually express', () => {
		expect(SIGN_IN_RULE.windowSeconds).toBeGreaterThanOrEqual(60);
		expect(SIGN_UP_RULE.windowSeconds).toBeGreaterThanOrEqual(60);
	});

	// A limit of zero would lock everyone out on the first attempt.
	it('allows at least one attempt per window', () => {
		expect(SIGN_IN_RULE.limit).toBeGreaterThan(0);
		expect(SIGN_UP_RULE.limit).toBeGreaterThan(0);
	});
});
