// Money is stored and moved around as an integer number of centavos.
//
// It used to be a float (`real` columns, reais as the unit), which is the wrong
// base for money and had already produced three concrete defects, not just a
// theoretical rounding worry:
//
//   - `findSupersedeCandidate` compared amounts with SQL `=` — float equality —
//     to decide whether a Pluggy transaction supersedes one extracted from a
//     PDF. Two values that differ in the last bit are not equal, so the dedupe
//     silently failed and the same purchase appeared twice.
//   - `markInternalTransfers` grouped by `Math.abs(amount).toFixed(2)` while
//     the dedupe compared raw floats — two different notions of "same amount"
//     in the same pipeline.
//   - Sums accumulated error, papered over by `Math.round(x * 100) / 100` at
//     eight separate call sites, each of which had to remember to do it.
//
// With integers all three disappear: equality is exact, grouping needs no
// stringification, and a sum of integers is exact. The conversion happens at
// exactly two boundaries — parsing user/API input on the way in, and rendering
// on the way out — and never in between.

/** Cents → reais, for display and for anything that needs a decimal. */
export function toReais(cents: number): number {
	return cents / 100;
}

/**
 * Reais → cents, rounded to the nearest centavo.
 *
 * `Math.round` and not truncation: the API sends values like 782.5399999999999
 * for what is really R$ 782,54, and truncating would lose a centavo on roughly
 * half of all imported transactions.
 */
export function toCents(reais: number): number {
	return Math.round(reais * 100);
}

/**
 * Parses money typed by a person: "1.234,56", "1234,56", "1234.56", "-50".
 *
 * Returns null when the text is not a number, so the caller can tell "invalid"
 * from "zero" — `Number('')` is 0, which silently turned an empty field into a
 * R$ 0,00 transaction.
 */
export function parseCents(raw: unknown): number | null {
	const text = String(raw ?? '').trim();
	if (!text) return null;

	// pt-BR: dots group thousands, the comma is the decimal separator. Only strip
	// dots when a comma is present — otherwise "1234.56" (a plain machine-format
	// number) would become 123456.
	const normalised = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;

	const value = Number(normalised);
	return Number.isFinite(value) ? toCents(value) : null;
}
