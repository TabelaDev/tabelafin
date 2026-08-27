import { describe, expect, it } from 'vitest';

import { computeDedupeHash } from './dedupe';

describe('computeDedupeHash', () => {
	it('is deterministic for the same account/amount/day', () => {
		const a = computeDedupeHash('acc-1', -15.5, new Date('2026-07-30T10:00:00.000Z'));
		const b = computeDedupeHash('acc-1', -15.5, new Date('2026-07-30T22:00:00.000Z'));
		expect(a).toBe(b);
	});

	it('differs when the account differs', () => {
		const a = computeDedupeHash('acc-1', -15.5, new Date('2026-07-30T00:00:00.000Z'));
		const b = computeDedupeHash('acc-2', -15.5, new Date('2026-07-30T00:00:00.000Z'));
		expect(a).not.toBe(b);
	});

	it('differs when the amount differs', () => {
		const a = computeDedupeHash('acc-1', -15.5, new Date('2026-07-30T00:00:00.000Z'));
		const b = computeDedupeHash('acc-1', -16.5, new Date('2026-07-30T00:00:00.000Z'));
		expect(a).not.toBe(b);
	});

	it('differs when the day differs, even by one day (range tolerance lives elsewhere)', () => {
		const a = computeDedupeHash('acc-1', -15.5, new Date('2026-07-30T00:00:00.000Z'));
		const b = computeDedupeHash('acc-1', -15.5, new Date('2026-07-31T00:00:00.000Z'));
		expect(a).not.toBe(b);
	});
});
