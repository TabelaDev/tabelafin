// BRL currency formatting with optional compaction: large values stay readable
// ("R$ 2,5 mil", "R$ 1,2 M") instead of turning into a row of digits.
//
// Uses the runtime's own Intl.NumberFormat with notation:'compact' — no manual
// suffix table — and `maximumFractionDigits` so it does not read
// "R$ 2,53 mil" when it does not need to.
//
// **Every function here takes integer centavos**, not reais. This is the one
// place money turns into a string, so putting the conversion here means the
// three dozen call sites that render a value needed no change when the columns
// moved off floats — and no call site can forget to convert, because there is
// nothing left for it to do.
import { toReais } from './money';

const compactBRL = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRL',
	notation: 'compact',
	maximumFractionDigits: 1
});

const fullBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// A signed credit-card balance can legitimately be `-0` (unary minus on zero);
// `Intl` renders that as "-R$ 0,00". Normalise negative zero to plain zero so a
// nil balance never shows a spurious minus sign.
const normaliseZero = (n: number) => (Object.is(n, -0) ? 0 : n);

/** @param cents integer centavos. `threshold` is in reais, as before. */
export function formatCompactCurrency(cents: number, threshold = 100_000): string {
	const value = normaliseZero(toReais(cents));
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
/** @param value integer centavos, as whatever Apex is holding for the point. */
export function formatCurrencyLabel(value: unknown): string {
	// Checked before Number(), which turns null, undefined-ish and '' into 0 —
	// a missing point would otherwise be labelled "R$ 0" as if it were data.
	if (value === null || value === undefined || value === '') return '';
	const n = Number(value);
	if (!Number.isFinite(n)) return '';
	return labelBRL.format(normaliseZero(toReais(n)));
}

// Full BRL format, the same `fullBRL` the compact helpers use internally. Pages
// used to re-create this Intl.NumberFormat themselves — a single export here.
/** @param cents integer centavos. */
export function formatCurrency(cents: number): string {
	return fullBRL.format(normaliseZero(toReais(cents)));
}

// Bare compact format (no currency), for chart axes and tooltips: "2,5 mil",
// "1,2 M". Used where the "R$" prefix already appears in the surrounding text.
/** @param cents integer centavos. `threshold` is in reais. */
export function formatCompactNumber(cents: number, threshold = 100_000): string {
	const value = toReais(cents);
	if (Math.abs(value) < threshold) return normaliseZero(value).toLocaleString('pt-BR');
	return new Intl.NumberFormat('pt-BR', {
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(normaliseZero(value));
}

// Date helpers shared by the pages (dashboard, upcoming, transactions). The
// month key (YYYY-MM) is what everything groups by; monthLabel renders it for
// display.

// Transaction dates are stored at UTC midnight — that is what the Pluggy API
// sends, what the manual form writes, and what PDF extraction produces. A date
// is therefore a calendar day, not an instant: rendering it in the browser's
// own zone put every transaction one day earlier for anyone west of UTC, which
// is every Brazilian user. Formatting in UTC reads the day back exactly as it
// was stored.
const DISPLAY_TIME_ZONE = 'UTC';

export function formatDate(ts: Date | string): string {
	const d = typeof ts === 'string' ? new Date(ts) : ts;
	return d.toLocaleDateString('pt-BR', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		timeZone: DISPLAY_TIME_ZONE
	});
}

// Same UTC-anchored date as formatDate, spelled out for single-transaction
// detail views ("23 de agosto de 2026" instead of "23 ago. 2026").
export function formatDateLong(ts: Date | string): string {
	const d = typeof ts === 'string' ? new Date(ts) : ts;
	return d.toLocaleDateString('pt-BR', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
		timeZone: DISPLAY_TIME_ZONE
	});
}

export function toYearMonth(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
	const [y, m] = key.split('-').map(Number);
	const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
		month: 'long',
		year: 'numeric'
	});
	return label.charAt(0).toUpperCase() + label.slice(1);
}
