// Fixed category taxonomy — ESCOPO.md does not define a list, so this is the
// product decision: a set lean enough that the AI does not hesitate between
// lookalike options, but that covers the essentials of personal spending and
// income. Shared between batch categorisation (server/ai/categorize.ts) and the
// dashboard display — never duplicate this list anywhere else.
export const TRANSACTION_CATEGORIES = [
	'Alimentação',
	'Transporte',
	'Moradia',
	'Saúde',
	'Lazer',
	'Compras',
	'Educação',
	'Assinaturas',
	'Investimentos',
	'Transferências',
	'Renda',
	'Outros'
] as const;

/** One of the categories every account is seeded with. */
export type BuiltinCategory = (typeof TRANSACTION_CATEGORIES)[number];

/**
 * A category name as stored on a transaction.
 *
 * Categories are user-defined now (see the user_categories table), so the value
 * can be any name the user created — the list above only describes the seed
 * set. Keeping the closed union here made every path that carries a name out of
 * the database or off a form fail to type-check against its own data.
 */
export type TransactionCategory = string;

// Catppuccin colour per category — used in badges and charts. The classes are
// static (Tailwind has to see the complete string to emit the CSS), which is why
// this is a map of literals rather than template strings. Covers the default
// categories only; user-created ones carry their own colour.
export const CATEGORY_COLORS: Record<BuiltinCategory, string> = {
	Alimentação: 'ctp-peach',
	Transporte: 'ctp-sky',
	Moradia: 'ctp-mauve',
	Saúde: 'ctp-green',
	Lazer: 'ctp-pink',
	Compras: 'ctp-yellow',
	Educação: 'ctp-blue',
	Assinaturas: 'ctp-sapphire',
	Investimentos: 'ctp-teal',
	Transferências: 'ctp-surface1',
	Renda: 'ctp-green',
	Outros: 'ctp-overlay1'
};
