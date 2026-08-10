// Taxonomia fixa de categorias — ESCOPO.md não define uma lista, então esta é
// a decisão de produto: um conjunto enxuto o bastante pra IA não hesitar entre
// opções parecidas, mas que cobre o essencial de gasto/renda pessoal.
// Compartilhada entre a categorização em lote (server/ai/categorize.ts) e a
// exibição no dashboard — nunca duplicar esta lista em outro lugar.
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

// Cor Catppuccin por categoria — usada nos badges e gráficos. As classes são
// estáticas (Tailwind precisa ver a string completa pra gerar o CSS), por isso
// o map com literais em vez de template strings. Cobre só as categorias
// padrão; as do usuário trazem a própria cor.
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
