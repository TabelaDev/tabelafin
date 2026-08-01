import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { getDb } from './index';
import { transactions } from './schema';
import type { TransactionCategory } from '$lib/categories';

type Db = ReturnType<typeof getDb>;

export interface NewPluggyTransactionInput {
	userId: string;
	accountId: string;
	pluggyTransactionId: string;
	date: Date;
	description: string;
	amount: number;
	currency: string;
	dedupeHash: string;
}

export async function getTransactionByPluggyId(db: Db, pluggyTransactionId: string) {
	const [row] = await db
		.select()
		.from(transactions)
		.where(eq(transactions.pluggyTransactionId, pluggyTransactionId));
	return row ?? null;
}

// Insere uma transação vinda do sync da Pluggy. `onConflictDoNothing` cobre o
// caso raro de duas execuções concorrentes do cron tentarem inserir a mesma
// pluggyTransactionId — quem perder a corrida recebe `null` de volta em vez
// de estourar erro de unique constraint.
export async function insertPluggyTransaction(db: Db, input: NewPluggyTransactionInput) {
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
			// Categorizada depois, em lote, no final do sync (ver
			// categorizeNewTransactions em server/pluggy/sync.ts) — nunca aqui,
			// transação por transação.
			category: null,
			categorySource: null,
			dedupeHash: input.dedupeHash
		})
		.onConflictDoNothing({ target: transactions.pluggyTransactionId })
		.returning();
	return saved ?? null;
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

// `category_source='user'` nunca é sobrescrito por uma rodada de
// categorização em lote — só atualiza linhas ainda sem categoria manual.
export async function updateTransactionCategory(
	db: Db,
	transactionId: string,
	category: TransactionCategory
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
