import { describe, expect, it } from 'vitest';
import {
	formatCompactCurrency,
	formatCompactNumber,
	formatCurrencyLabel,
	formatDate
} from './format';

// Intl separates "R$" from the digits with a non-breaking space, and which
// one it picks varies between ICU versions. Compare on normalised whitespace
// so these assertions describe the format, not the runtime's space character.
const spaces = (value: string) => value.replace(/\s/g, ' ');

describe('formatCurrencyLabel', () => {
	it('formats a number as BRL without cents', () => {
		expect(spaces(formatCurrencyLabel(123456))).toBe('R$ 1.235');
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
		expect(spaces(formatCurrencyLabel(-4000))).toBe('-R$ 40');
	});

	// A signed credit-card balance of zero arrives as -0, which Intl renders as
	// "-R$ 0" — a nil balance must not show a minus sign.
	it('normalises negative zero to a plain zero', () => {
		expect(spaces(formatCurrencyLabel(-0))).toBe('R$ 0');
		expect(spaces(formatCompactCurrency(-0))).toBe('R$ 0,00');
		expect(spaces(formatCompactNumber(-0))).toBe('0');
	});
});

describe('formatCompactCurrency', () => {
	it('keeps values below the threshold in full', () => {
		expect(spaces(formatCompactCurrency(127109))).toBe('R$ 1.271,09');
	});

	// How ICU renders the compact form varies by version — "R$ 100 mil" here,
	// "R$ 100,0 mil" on CI — so assert the property that matters (it compacted
	// and dropped the long digit run) instead of pinning the digits.
	it('compacts values at or above the threshold', () => {
		// The threshold is stated in reais; the argument is centavos.
		const compacted = spaces(formatCompactCurrency(100_000_00));
		expect(compacted).toMatch(/^R\$ 100(,0)? mil$/);
		expect(compacted).not.toContain('100.000');
	});
});

describe('formatCompactNumber', () => {
	it('keeps values below the threshold in full', () => {
		expect(spaces(formatCompactNumber(2500_00))).toBe('2.500');
	});

	it('compacts values at or above the threshold', () => {
		const compacted = spaces(formatCompactNumber(1_200_000_00));
		expect(compacted).toMatch(/^1,2\s?mi/);
		expect(compacted).not.toContain('1.200.000');
	});
});

describe('formatDate', () => {
	// The regression: transaction dates are stored at UTC midnight, so rendering
	// them in the browser's own zone moved every one back a day for any user
	// west of UTC — which is every Brazilian user.
	it('renders the stored calendar day, not the local one', () => {
		expect(spaces(formatDate(new Date('2026-08-01T00:00:00.000Z')))).toBe('01 de ago. de 2026');
	});

	it('does not roll a month boundary backwards', () => {
		expect(spaces(formatDate(new Date('2026-03-01T00:00:00.000Z')))).toContain('01');
		expect(spaces(formatDate(new Date('2026-03-01T00:00:00.000Z')))).toContain('mar');
	});

	it('accepts an ISO string as well as a Date', () => {
		expect(formatDate('2026-08-01T00:00:00.000Z')).toBe(
			formatDate(new Date('2026-08-01T00:00:00.000Z'))
		);
	});
});
