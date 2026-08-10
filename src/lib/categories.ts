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

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

// Cor Catppuccin por categoria — usada nos badges e gráficos. As classes são
// estáticas (Tailwind precisa ver a string completa pra gerar o CSS), por isso
// o map com literais em vez de template strings.
export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
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
