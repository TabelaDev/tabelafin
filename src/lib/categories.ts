// Taxonomia fixa de categorias — ESCOPO.md não define uma lista, então esta é
// a decisão de produto: um conjunto enxuto o bastante pra IA não hesitar entre
// opções parecidas, mas que cobre o essencial de gasto/renda pessoal no Brasil.
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

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];
