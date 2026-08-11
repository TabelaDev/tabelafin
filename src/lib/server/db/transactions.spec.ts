import { describe, expect, it } from 'vitest';
import { amountsMatchForDedupe, isWithinSupersedeWindow } from './transactions';

// The rule that decides whether a row extracted from a statement PDF is already
// covered by something the user has. Getting it wrong in either direction is
// expensive: too loose hides real transactions, too strict double-counts an
// entire imported month.
describe('amountsMatchForDedupe', () => {
	it('matches identical amounts', () => {
		expect(amountsMatchForDedupe(-782.54, -782.54)).toBe(true);
	});

	// The PDF extractor writes an expense as negative; the API reports a credit
	// card purchase as positive. Comparing exact values missed every card
	// duplicate, which is most of them.
	it('matches across the credit-card sign inversion', () => {
		expect(amountsMatchForDedupe(-782.54, 782.54)).toBe(true);
	});

	it('does not match different amounts', () => {
		expect(amountsMatchForDedupe(-782.54, -782.55)).toBe(false);
	});

	it('does not match on magnitude alone when the values differ', () => {
		expect(amountsMatchForDedupe(-100, -1000)).toBe(false);
	});
});

describe('isWithinSupersedeWindow', () => {
	const base = new Date('2026-03-15T00:00:00.000Z');

	it('accepts the same day', () => {
		expect(isWithinSupersedeWindow(base, new Date('2026-03-15T23:00:00.000Z'))).toBe(true);
	});

	it('accepts three days apart, in both directions', () => {
		expect(isWithinSupersedeWindow(base, new Date('2026-03-18T00:00:00.000Z'))).toBe(true);
		expect(isWithinSupersedeWindow(base, new Date('2026-03-12T00:00:00.000Z'))).toBe(true);
	});

	it('rejects four days apart', () => {
		expect(isWithinSupersedeWindow(base, new Date('2026-03-19T00:00:00.000Z'))).toBe(false);
		expect(isWithinSupersedeWindow(base, new Date('2026-03-11T00:00:00.000Z'))).toBe(false);
	});
});
