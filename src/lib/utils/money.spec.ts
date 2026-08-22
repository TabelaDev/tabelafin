import { describe, it, expect } from 'vitest';
import { parseCents, toCents, toReais } from './money';

describe('toCents', () => {
	it('converts a plain value', () => {
		expect(toCents(782.54)).toBe(78254);
	});

	// The regression this whole migration exists for: the Pluggy API sends
	// 782.5399999999999 for what is R$ 782,54. Truncating would lose a centavo on
	// roughly half of every import.
	it('rounds the float noise the API sends, rather than truncating', () => {
		// Built by arithmetic, not written as a literal: the whole point is a value
		// that cannot be represented exactly, and a literal of one trips
		// no-loss-of-precision. 8.2 + 0.1 lands at 8.299999999999999 — truncating
		// that gives 829 centavos instead of 830.
		const low = 8.2 + 0.1;
		expect(low).not.toBe(8.3);
		expect(toCents(low)).toBe(830);

		// And the other direction: 35.300000000000004 must not become 3531.
		const high = 35.1 + 0.2;
		expect(high).not.toBe(35.3);
		expect(toCents(high)).toBe(3530);

		expect(toCents(0.1 + 0.2)).toBe(30);
	});

	it('keeps the sign', () => {
		expect(toCents(-45.9)).toBe(-4590);
	});

	it('handles zero and negative zero identically', () => {
		expect(toCents(0)).toBe(0);
		expect(Object.is(toCents(-0), -0) || toCents(-0) === 0).toBe(true);
	});
});

describe('toReais', () => {
	it('is the inverse of toCents for representable values', () => {
		for (const value of [0, 1.5, 782.54, -45.9, 1_000_000.99]) {
			expect(toReais(toCents(value))).toBeCloseTo(value, 2);
		}
	});
});

describe('a sum of cents is exact', () => {
	// The whole point: in reais this sum is 0.30000000000000004, which is why
	// eight call sites had to remember `Math.round(x * 100) / 100`.
	it('adds without accumulating error', () => {
		expect(toCents(0.1) + toCents(0.2)).toBe(30);
	});

	it('stays exact over many values', () => {
		const values = Array.from({ length: 1000 }, () => 0.07);
		const cents = values.reduce((sum, v) => sum + toCents(v), 0);
		expect(cents).toBe(7000);
	});
});

describe('parseCents', () => {
	it('parses the pt-BR format a person types', () => {
		expect(parseCents('1.234,56')).toBe(123456);
		expect(parseCents('1234,56')).toBe(123456);
		expect(parseCents('0,07')).toBe(7);
	});

	// A dot with no comma is a machine-format decimal, not a thousands
	// separator — stripping it unconditionally turned 1234.56 into 123456.00.
	it('treats a lone dot as a decimal separator', () => {
		expect(parseCents('1234.56')).toBe(123456);
	});

	it('parses negatives and whitespace', () => {
		expect(parseCents('  -50  ')).toBe(-5000);
	});

	// Number('') is 0, which silently made an empty field a R$ 0,00 transaction.
	it('returns null for empty or invalid input, never zero', () => {
		expect(parseCents('')).toBeNull();
		expect(parseCents('   ')).toBeNull();
		expect(parseCents('abc')).toBeNull();
		expect(parseCents(null)).toBeNull();
		expect(parseCents(undefined)).toBeNull();
	});

	it('parses an explicit zero as zero', () => {
		expect(parseCents('0')).toBe(0);
		expect(parseCents('0,00')).toBe(0);
	});
});
