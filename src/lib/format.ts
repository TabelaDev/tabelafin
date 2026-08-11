// BRL currency formatting with optional compaction: large values stay readable
// ("R$ 2,5 mil", "R$ 1,2 M") instead of turning into a row of digits.
//
// Uses the runtime's own Intl.NumberFormat with notation:'compact' — no manual
// suffix table — and `maximumFractionDigits` so it does not read
// "R$ 2,53 mil" when it does not need to.

const compactBRL = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRL',
	notation: 'compact',
	maximumFractionDigits: 1
});

const fullBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCompactCurrency(value: number, threshold = 100_000): string {
	return Math.abs(value) >= threshold ? compactBRL.format(value) : fullBRL.format(value);
}

const labelBRL = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRL',
	maximumFractionDigits: 0
});

// Data label for chart bars: BRL without cents, so the value fits beside the
// bar. Takes `unknown` because Apex hands the formatter whatever it holds for
// the point — anything non-numeric renders as an empty label, never "NaN".
export function formatCurrencyLabel(value: unknown): string {
	// Checked before Number(), which turns null, undefined-ish and '' into 0 —
	// a missing point would otherwise be labelled "R$ 0" as if it were data.
	if (value === null || value === undefined || value === '') return '';
	const n = Number(value);
	if (!Number.isFinite(n)) return '';
	return labelBRL.format(n);
}

// Bare compact format (no currency), for chart axes and tooltips: "2,5 mil",
// "1,2 M". Used where the "R$" prefix already appears in the surrounding text.
export function formatCompactNumber(value: number, threshold = 100_000): string {
	if (Math.abs(value) < threshold) return value.toLocaleString('pt-BR');
	return new Intl.NumberFormat('pt-BR', {
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(value);
}
