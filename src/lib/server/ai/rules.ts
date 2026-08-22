// Rule-based categorisation (keyword matching) — used when the user has no AI
// configured. A simple offline fallback that needs no external call. The user can
// always override the category by hand.
import type { TransactionCategory } from '$lib/utils/categories';

interface Rule {
	keywords: string[];
	category: TransactionCategory;
}

// Rules in priority order — the first one that matches wins.
const RULES: Rule[] = [
	// Investments
	{
		keywords: [
			'cdb',
			'tesouro',
			'renda fixa',
			'aplicação',
			'resgate',
			'investimento',
			'fii',
			'ação'
		],
		category: 'Investimentos'
	},

	// Transfers
	{ keywords: ['pix', 'ted', 'doc', 'transferência', 'transferencia'], category: 'Transferências' },

	// Food
	{
		keywords: [
			'ifood',
			'rappi',
			'uber eats',
			'ifd',
			'restaurante',
			'lanchonete',
			'padaria',
			'supermercado',
			'mercadolivre',
			'mercado livre',
			'extra',
			'carrefour',
			'pao de acucar',
			'pão de açúcar'
		],
		category: 'Alimentação'
	},

	// Transport
	{
		keywords: [
			'uber',
			'99',
			'taxi',
			'gasolina',
			'combustível',
			'estacionamento',
			'pedágio',
			'rodoviaria',
			'passagem',
			'bilhete unico',
			'recarga bilhete'
		],
		category: 'Transporte'
	},

	// Housing
	{
		keywords: [
			'aluguel',
			'condomínio',
			'iptu',
			'luz',
			'água',
			'agua',
			'gas',
			'gás',
			'internet',
			'telefone',
			'fixo'
		],
		category: 'Moradia'
	},

	// Health
	{
		keywords: [
			'farmácia',
			'farmacia',
			'hospital',
			'médico',
			'medico',
			'dentista',
			'plano de saúde',
			'unimed',
			'consulta',
			'exame',
			'remédio',
			'remedio'
		],
		category: 'Saúde'
	},

	// Leisure
	{
		keywords: [
			'netflix',
			'spotify',
			'cinema',
			'teatro',
			'show',
			'bar',
			'cerveja',
			'streaming',
			'jogo',
			'game',
			'steam',
			'playstation',
			'xbox'
		],
		category: 'Lazer'
	},

	// Education
	{
		keywords: [
			'escola',
			'universidade',
			'faculdade',
			'curso',
			'udemy',
			'alura',
			'livro',
			'material escolar'
		],
		category: 'Educação'
	},

	// Subscriptions
	{
		keywords: [
			'assinatura',
			'mensalidade',
			'subscription',
			'cloud',
			'hosting',
			'domínio',
			'dominio'
		],
		category: 'Assinaturas'
	},

	// Shopping
	{
		keywords: [
			'amazon',
			'mercadolivre',
			'mercado livre',
			'shopee',
			'magazine luiza',
			'magalu',
			'americanas',
			'casas bahia',
			'compra'
		],
		category: 'Compras'
	},

	// Income
	{
		keywords: [
			'salário',
			'salario',
			'renda',
			'freelance',
			'pagamento recebido',
			'estorno',
			'reembolso',
			'cashback'
		],
		category: 'Renda'
	}
];

export function categorizeByRules(description: string): TransactionCategory | null {
	const lower = description.toLowerCase();
	for (const rule of RULES) {
		if (rule.keywords.some((kw) => lower.includes(kw))) {
			return rule.category;
		}
	}
	return null;
}
