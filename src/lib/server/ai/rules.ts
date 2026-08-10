// Categorização por regras (keyword matching) — usada quando o usuário não tem
// IA configurada. É uma alternativa simples e offline que não requer nenhuma
// chamada externa. O usuário pode sempre sobrescrever a categoria manualmente.
import type { TransactionCategory } from '$lib/categories';

interface Rule {
	keywords: string[];
	category: TransactionCategory;
}

// Regras ordenadas por prioridade — a primeira regra que matchar vence.
const RULES: Rule[] = [
	// Investimentos
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

	// Transferências
	{ keywords: ['pix', 'ted', 'doc', 'transferência', 'transferencia'], category: 'Transferências' },

	// Alimentação
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

	// Transporte
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

	// Moradia
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

	// Saúde
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

	// Lazer
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

	// Educação
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

	// Assinaturas
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

	// Compras
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

	// Renda
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
