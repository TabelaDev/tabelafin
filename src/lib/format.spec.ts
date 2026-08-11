import { describe, expect, it } from 'vitest';
import { formatCompactCurrency, formatCompactNumber, formatCurrencyLabel } from './format';

// Intl separates "R$" from the digits with a non-breaking space, and which
// one it picks varies between ICU versions. Compare on normalised whitespace
// so these assertions describe the format, not the runtime's space character.
const spaces = (value: string) => value.replace(/\s/g, ' ');

describe('formatCurrencyLabel', () => {
	it('formats a number as BRL without cents', () => {
		expect(spaces(formatCurrencyLabel(1234.56))).toBe('R$ 1.235');
	});

	// The chart bug this guard exists for: on a horizontal bar Apex hands the
	// label formatter the category name, and "NaN" used to be rendered for every
	// category on the axis.
	it('returns an empty label for non-numeric input', () => {
		expect(formatCurrencyLabel('Alimentação')).toBe('');
		expect(formatCurrencyLabel(null)).toBe('');
		expect(formatCurrencyLabel(undefined)).toBe('');
		expect(formatCurrencyLabel(NaN)).toBe('');
	});

	it('keeps negative values signed', () => {
		expect(spaces(formatCurrencyLabel(-40))).toBe('-R$ 40');
	});
});

describe('formatCompactCurrency', () => {
	it('keeps values below the threshold in full', () => {
		expect(spaces(formatCompactCurrency(1271.09))).toBe('R$ 1.271,09');
	});

	// How ICU renders the compact form varies by version — "R$ 100 mil" here,
	// "R$ 100,0 mil" on CI — so assert the property that matters (it compacted
	// and dropped the long digit run) instead of pinning the digits.
	it('compacts values at or above the threshold', () => {
		const compacted = spaces(formatCompactCurrency(100_000));
		expect(compacted).toMatch(/^R\$ 100(,0)? mil$/);
		expect(compacted).not.toContain('100.000');
	});
});

describe('formatCompactNumber', () => {
	it('keeps values below the threshold in full', () => {
		expect(spaces(formatCompactNumber(2500))).toBe('2.500');
	});

	it('compacts values at or above the threshold', () => {
		const compacted = spaces(formatCompactNumber(1_200_000));
		expect(compacted).toMatch(/^1,2\s?mi/);
		expect(compacted).not.toContain('1.200.000');
	});
});
