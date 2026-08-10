import { and, eq, gte, isNull, lte, notInArray, or } from 'drizzle-orm';
import type { getDb } from './index';
import { transactions } from './schema';
import type { TransactionCategory } from '$lib/categories';
import {
	INTERNAL_TRANSFER_CATEGORIES,
	INTERNAL_TRANSFER_DESCRIPTIONS
} from '$lib/server/pluggy/internal-transfers';
import { getRuleForDescription } from '$lib/server/db/categorization-rules';

type Db = ReturnType<typeof getDb>;

export interface NewPluggyTransactionInput {
	userId: string;
	accountId: string;
	pluggyTransactionId: string;
	date: Date;
	description: string;
	amount: number;
	currency: string;
	pluggyCategory: string | null;
	dedupeHash: string;
}

export async function getTransactionByPluggyId(db: Db, pluggyTransactionId: string) {
	const [row] = await db
		.select()
		.from(transactions)
		.where(eq(transactions.pluggyTransactionId, pluggyTransactionId));
	return row ?? null;
}

// Atualiza só a `pluggyCategory` de uma transação já existente (usado no
// re-sync pra popular o campo em transações que entraram antes dele existir).
export async function updatePluggyCategory(
	db: Db,
	pluggyTransactionId: string,
	category: string | null
) {
	await db
		.update(transactions)
		.set({ pluggyCategory: category })
		.where(eq(transactions.pluggyTransactionId, pluggyTransactionId));
}

// Atualiza o `amount` de uma transação já existente (usado no re-sync pra
// corrigir transações estrangeiras gravadas antes do amount convertido).
export async function updatePluggyAmount(db: Db, pluggyTransactionId: string, amount: number) {
	await db
		.update(transactions)
		.set({ amount })
		.where(eq(transactions.pluggyTransactionId, pluggyTransactionId));
}

// Insere uma transação vinda do sync da Pluggy. Aplica regra automática do
// usuário (descrição → categoria) quando existe — transação já nasce
// categorizada (categorySource='rule'). `onConflictDoUpdate` preenche o
// `pluggyCategory` quando a transação já existe (ex.: re-sync após o campo ter
// sido adicionado ao schema) — a categoria da API muda pouco, então
// sobrescrever é seguro. O retorno só é usado pra saber se foi insert novo
// (null = já existia), pra não rodar o dedupe/supersede de novo.
export async function insertPluggyTransaction(db: Db, input: NewPluggyTransactionInput) {
	// Regra do usuário (criada quando ele categoriza manualmente uma descrição)
	// tem prioridade sobre a categorização por IA/regras offline.
	const rule = await getRuleForDescription(db, input.userId, input.description);

	const [saved] = await db
		.insert(transactions)
		.values({
			userId: input.userId,
			accountId: input.accountId,
			pluggyTransactionId: input.pluggyTransactionId,
			date: input.date,
			description: input.description,
			amount: input.amount,
			currency: input.currency,
			source: 'pluggy',
			pluggyCategory: input.pluggyCategory,
			// Aplicada a regra automática na inserção; caso contrário fica pra
			// categorização em lote (IA/regras offline) no final do sync.
			category: rule?.category ?? null,
			categorySource: rule ? 'rule' : null,
			dedupeHash: input.dedupeHash
		})
		.onConflictDoUpdate({
			target: transactions.pluggyTransactionId,
			set: {
				pluggyCategory: input.pluggyCategory
			}
		})
		.returning();
	return saved ?? null;
}

export interface NewPdfTransactionInput {
	userId: string;
	statementUploadId: string;
	date: Date;
	description: string;
	amount: number;
	currency: string;
	category: TransactionCategory;
}

// Insere uma transação extraída de um upload de PDF (fallback manual). Já vem
// categorizada de fábrica — a extração e a categorização acontecem no mesmo
// request de IA (ESCOPO.md §2.4), então categorySource='ai' aqui e nenhuma
// rodada futura de categorização em lote re-toca (lote só olha linhas com
// category IS NULL). dedupeHash fica null: sem conta vinculada não há chave
// de dedupe válida, e a regra de supersede (findSupersedeCandidate) compara
// conta/valor/data direto, sem usar o hash.
export async function insertPdfTransaction(db: Db, input: NewPdfTransactionInput) {
	const [saved] = await db
		.insert(transactions)
		.values({
			userId: input.userId,
			statementUploadId: input.statementUploadId,
			date: input.date,
			description: input.description,
			amount: input.amount,
			currency: input.currency,
			source: 'pdf_upload',
			category: input.category,
			categorySource: 'ai',
			dedupeHash: null
		})
		.returning();
	return saved;
}

export interface NewManualTransactionInput {
	userId: string;
	date: Date;
	description: string;
	amount: number;
	category: TransactionCategory | null;
}

// Insere uma transação digitada manualmente pelo usuário. Pode vir com
// categoria (digitada ou sugerida por regras) ou sem (fica NULL até
// categorização futura). categorySource='user' quando o usuário escolheu,
// null quando ficou sem categoria.
export async function insertManualTransaction(db: Db, input: NewManualTransactionInput) {
	const [saved] = await db
		.insert(transactions)
		.values({
			userId: input.userId,
			date: input.date,
			description: input.description,
			amount: input.amount,
			currency: 'BRL',
			source: 'manual',
			category: input.category,
			categorySource: input.category ? 'user' : null,
			dedupeHash: null
		})
		.returning();
	return saved;
}

// ESCOPO.md §5 — regra de dedupe: uma transação vinda de PDF (ainda não
// superada por nenhuma outra) é candidata a duplicata de uma transação nova
// da Pluggy quando: mesmo valor, data dentro de ±3 dias, e (mesma conta OU a
// linha de PDF ainda não tinha conta vinculada — accountId é nullable em
// transactions justamente pra esse caso, ver schema.ts).
const SUPERSEDE_TOLERANCE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function findSupersedeCandidate(
	db: Db,
	userId: string,
	accountId: string,
	amount: number,
	date: Date
) {
	const from = new Date(date.getTime() - SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
	const to = new Date(date.getTime() + SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
	const [row] = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.source, 'pdf_upload'),
				eq(transactions.amount, amount),
				isNull(transactions.supersededByTransactionId),
				gte(transactions.date, from),
				lte(transactions.date, to),
				or(eq(transactions.accountId, accountId), isNull(transactions.accountId))
			)
		);
	return row ?? null;
}

export async function markSuperseded(
	db: Db,
	oldTransactionId: string,
	newTransactionId: string
): Promise<void> {
	await db
		.update(transactions)
		.set({ supersededByTransactionId: newTransactionId })
		.where(eq(transactions.id, oldTransactionId));
}

// Transações prontas pra entrar num lote de categorização (ESCOPO.md §3.3):
// sem categoria ainda e não superadas (uma linha de PDF substituída nunca
// precisa de categoria própria, ela some das telas mesmo assim).
export async function getUncategorizedTransactions(db: Db, userId: string) {
	return db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				isNull(transactions.category),
				isNull(transactions.supersededByTransactionId)
			)
		);
}

// Transações de um usuário num intervalo [from, to) — usado pelo relatório
// mensal (server/reports/generate.ts). `to` é exclusivo de propósito (ver
// chamador: passa o primeiro dia do mês seguinte). Exclui transferência
// interna/movimentação de investimento — não são gasto nem receita (categoria
// da API + descrição, ex.: "Pagamento de fatura").
export async function getTransactionsInRange(db: Db, userId: string, from: Date, to: Date) {
	return db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				isNull(transactions.supersededByTransactionId),
				notInArray(transactions.pluggyCategory, [...INTERNAL_TRANSFER_CATEGORIES]),
				notInArray(transactions.description, [...INTERNAL_TRANSFER_DESCRIPTIONS]),
				gte(transactions.date, from),
				lte(transactions.date, new Date(to.getTime() - 1))
			)
		);
}

// `category_source='user'` nunca é sobrescrito por uma rodada de
// categorização em lote — só atualiza linhas ainda sem categoria manual.
// Categoria pode ser customizada (string livre); regras/IA escrevem
// categorySource='ai', a regra automática do usuário também.
export async function updateTransactionCategory(
	db: Db,
	transactionId: string,
	category: string
): Promise<void> {
	await db
		.update(transactions)
		.set({ category, categorySource: 'ai' })
		.where(
			and(
				eq(transactions.id, transactionId),
				or(isNull(transactions.categorySource), eq(transactions.categorySource, 'ai'))
			)
		);
}
