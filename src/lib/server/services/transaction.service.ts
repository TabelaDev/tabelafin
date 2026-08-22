import { and, eq, gt, gte, inArray, isNull, lte, ne, notInArray, or, sql } from 'drizzle-orm';
import { transactions } from '$lib/server/db/schema';
import { getRuleForDescription } from '$lib/server/db/categorization-rules';
import { TransactionSource } from '$lib/enums/transaction-source';
import { Currency } from '$lib/enums/currency';
import { getDb } from '$lib/server/db';
import {
	INTERNAL_TRANSFER_CATEGORIES,
	INTERNAL_TRANSFER_DESCRIPTIONS
} from '$lib/server/pluggy/internal-transfers';

type Db = ReturnType<typeof getDb>;

const SUPERSEDE_TOLERANCE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MovementSplit {
	expense: number;
	income: number;
}

export interface PluggyTransactionInput {
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

export interface PdfTransactionInput {
	userId: string;
	statementUploadId: string;
	date: Date;
	description: string;
	amount: number;
	currency: string;
	category: string;
}

export interface ManualTransactionInput {
	userId: string;
	date: Date;
	description: string;
	amount: number;
	category: string | null;
}

export class TransactionService {
	constructor(private db: Db) {}

	// Internal transfer predicates (exported for use in queries)
	get isNotInternalTransfer() {
		return and(
			or(
				isNull(transactions.pluggyCategory),
				notInArray(transactions.pluggyCategory, [...INTERNAL_TRANSFER_CATEGORIES])
			),
			or(
				isNull(transactions.description),
				notInArray(transactions.description, [...INTERNAL_TRANSFER_DESCRIPTIONS])
			)
		);
	}

	classifyMovement(accountType: string | null | undefined, amount: number): MovementSplit {
		if (accountType === 'credit_card') {
			return { expense: amount, income: 0 };
		}
		return amount >= 0 ? { expense: 0, income: amount } : { expense: -amount, income: 0 };
	}

	async insertFromPluggy(input: PluggyTransactionInput) {
		const rule = await getRuleForDescription(this.db, input.userId, input.description);

		const [saved] = await this.db
			.insert(transactions)
			.values({
				userId: input.userId,
				accountId: input.accountId,
				pluggyTransactionId: input.pluggyTransactionId,
				date: input.date,
				description: input.description,
				amount: input.amount,
				currency: input.currency,
				source: TransactionSource.Pluggy,
				pluggyCategory: input.pluggyCategory,
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

	async insertFromPdf(input: PdfTransactionInput) {
		const covering = await this.findTransactionCoveringPdfRow(
			input.userId,
			input.amount,
			input.date
		);

		const [saved] = await this.db
			.insert(transactions)
			.values({
				userId: input.userId,
				statementUploadId: input.statementUploadId,
				date: input.date,
				description: input.description,
				amount: input.amount,
				currency: input.currency,
				source: TransactionSource.PdfUpload,
				category: input.category,
				categorySource: 'ai',
				dedupeHash: null,
				supersededByTransactionId: covering?.id ?? null
			})
			.returning();
		return { transaction: saved, supersededBy: covering?.id ?? null };
	}

	async insertManual(input: ManualTransactionInput) {
		const [saved] = await this.db
			.insert(transactions)
			.values({
				userId: input.userId,
				date: input.date,
				description: input.description,
				amount: input.amount,
				currency: Currency.BRL,
				source: TransactionSource.Manual,
				category: input.category,
				categorySource: input.category ? 'user' : null,
				dedupeHash: null
			})
			.returning();
		return saved;
	}

	async updatePluggyFields(
		pluggyTransactionId: string,
		fields: { category: string | null; amount: number; accountId: string }
	) {
		await this.db
			.update(transactions)
			.set({ pluggyCategory: fields.category, amount: fields.amount, accountId: fields.accountId })
			.where(eq(transactions.pluggyTransactionId, pluggyTransactionId));
	}

	async getByPluggyId(pluggyTransactionId: string) {
		const [row] = await this.db
			.select()
			.from(transactions)
			.where(eq(transactions.pluggyTransactionId, pluggyTransactionId));
		return row ?? null;
	}

	async getExistingPluggyIds(pluggyTransactionIds: string[]): Promise<Set<string>> {
		const found = new Set<string>();
		const CHUNK = 200;
		for (let i = 0; i < pluggyTransactionIds.length; i += CHUNK) {
			const chunk = pluggyTransactionIds.slice(i, i + CHUNK);
			if (chunk.length === 0) continue;
			const rows = await this.db
				.select({ pluggyTransactionId: transactions.pluggyTransactionId })
				.from(transactions)
				.where(inArray(transactions.pluggyTransactionId, chunk));
			for (const row of rows) {
				if (row.pluggyTransactionId) found.add(row.pluggyTransactionId);
			}
		}
		return found;
	}

	private amountsMatchForDedupe(a: number, b: number): boolean {
		return Math.abs(a) === Math.abs(b);
	}

	private async findSupersedeCandidate(
		userId: string,
		accountId: string,
		amount: number,
		date: Date
	) {
		const from = new Date(date.getTime() - SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
		const to = new Date(date.getTime() + SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
		const [row] = await this.db
			.select()
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					eq(transactions.source, TransactionSource.PdfUpload),
					eq(sql`abs(${transactions.amount})`, Math.abs(amount)),
					isNull(transactions.supersededByTransactionId),
					gte(transactions.date, from),
					lte(transactions.date, to),
					eq(transactions.accountId, accountId)
				)
			);
		return row ?? null;
	}

	private async findTransactionCoveringPdfRow(userId: string, amount: number, date: Date) {
		const from = new Date(date.getTime() - SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
		const to = new Date(date.getTime() + SUPERSEDE_TOLERANCE_DAYS * DAY_MS);
		const candidates = await this.db
			.select()
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					ne(transactions.source, TransactionSource.PdfUpload),
					isNull(transactions.supersededByTransactionId),
					gte(transactions.date, from),
					lte(transactions.date, to)
				)
			);
		return candidates.find((row) => this.amountsMatchForDedupe(row.amount, amount)) ?? null;
	}

	async markSuperseded(oldTransactionId: string, newTransactionId: string) {
		await this.db
			.update(transactions)
			.set({ supersededByTransactionId: newTransactionId })
			.where(eq(transactions.id, oldTransactionId));
	}

	async renameCategory(userId: string, oldName: string, newName: string) {
		await this.db
			.update(transactions)
			.set({ category: newName })
			.where(and(eq(transactions.userId, userId), eq(transactions.category, oldName)));
	}

	async clearCategory(userId: string, name: string) {
		await this.db
			.update(transactions)
			.set({ category: null, categorySource: null })
			.where(and(eq(transactions.userId, userId), eq(transactions.category, name)));
	}

	async getUncategorized(userId: string) {
		return this.db
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

	async getByDateRange(userId: string, from: Date, to: Date) {
		return this.db
			.select()
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					isNull(transactions.supersededByTransactionId),
					this.isNotInternalTransfer,
					gte(transactions.date, from),
					lte(transactions.date, new Date(to.getTime() - 1))
				)
			);
	}

	async getFuture(userId: string) {
		const now = new Date();
		return this.db
			.select()
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					isNull(transactions.supersededByTransactionId),
					gt(transactions.date, now)
				)
			)
			.orderBy(transactions.date);
	}
}
