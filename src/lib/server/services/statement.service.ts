import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { statementReviews } from '$lib/server/db/schema';
import { TransactionService } from './transaction.service';
import { UserService } from './user.service';
import { parseWithParser } from '$lib/server/statements/index';
import { extractTransactionsFromPdf } from '$lib/server/ai/extract';
import { decryptSecret } from '$lib/server/crypto';
import { FileType } from '$lib/enums/file-type';
import { StatementReviewStatus } from '$lib/enums/statement-review';
import { Category } from '$lib/enums/category';
import { Currency } from '$lib/enums/currency';
import { modelSupportsDocuments } from '$lib/utils/ai-providers';
import type { AiProvider } from '$lib/utils/ai-providers';

type Db = ReturnType<typeof getDb>;

export interface ExtractResult {
	transactions: { date: string; description: string; amount: number; category?: string }[];
	method: 'parser' | 'ai';
}

export interface ApplyResult {
	inserted: number;
	duplicates: number;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

export class StatementService {
	constructor(
		private db: Db,
		private masterKey: string
	) {}

	async extractTransactions(userId: string, file: File, bankHint?: string): Promise<ExtractResult> {
		const fileType = this.detectFileType(file);
		const fileContent =
			fileType === FileType.Pdf ? arrayBufferToBase64(await file.arrayBuffer()) : await file.text();

		// Try parser first
		const parsed = parseWithParser(fileContent, bankHint);
		if (parsed) {
			return { transactions: parsed, method: 'parser' };
		}

		// Fallback to AI for PDFs
		if (fileType === FileType.Pdf) {
			const userService = new UserService(this.db);
			const user = await userService.findById(userId);
			if (!user) throw new Error('Usuário não encontrado.');

			const aiCredentials = await this.db.query.aiCredentials.findFirst({
				where: (creds: any, { eq }: any) => eq(creds.userId, userId)
			});
			if (!aiCredentials) throw new Error('Configure uma chave de API de IA antes de importar.');

			if (!modelSupportsDocuments(aiCredentials.provider as AiProvider, aiCredentials.model)) {
				throw new Error(`O modelo ${aiCredentials.model} não suporta upload de PDF.`);
			}

			const apiKey = await decryptSecret(
				this.masterKey,
				{
					ciphertext: aiCredentials.keyEncrypted,
					nonce: aiCredentials.nonce,
					v: aiCredentials.v ?? undefined
				},
				{ purpose: 'ai_credentials', userId }
			);

			const categories = await this.db.query.userCategories
				.findMany({ where: (cats: any, { eq }: any) => eq(cats.userId, userId) })
				.then((rows: any) => rows.map((r: any) => r.name));

			const aiTransactions = await extractTransactionsFromPdf({
				pdfBase64: fileContent,
				apiKey,
				provider: aiCredentials.provider as AiProvider,
				model: aiCredentials.model,
				categories,
				fileName: file.name
			});

			return {
				transactions: aiTransactions.map((t) => ({
					date: t.date,
					description: t.description,
					amount: Math.round(t.amount * 100),
					category: t.category
				})),
				method: 'ai'
			};
		}

		throw new Error(`Não foi possível analisar o arquivo ${fileType.toUpperCase()}.`);
	}

	async createReview(userId: string, file: File, bankHint?: string) {
		const fileType = this.detectFileType(file);
		const source = fileType === FileType.Csv ? 'csv' : 'single_pdf';

		const [review] = await this.db
			.insert(statementReviews)
			.values({
				userId,
				source: source as any,
				bank: bankHint as any,
				filename: file.name,
				status: StatementReviewStatus.Pending
			})
			.returning();

		return review;
	}

	async updateReviewStatus(
		reviewId: string,
		status: StatementReviewStatus,
		extra?: {
			extractedJson?: string;
			transactionCount?: number;
			duplicateCount?: number;
			errorMessage?: string;
		}
	) {
		await this.db
			.update(statementReviews)
			.set({
				status,
				...(extra?.extractedJson !== undefined && { extractedJson: extra.extractedJson }),
				...(extra?.transactionCount !== undefined && { transactionCount: extra.transactionCount }),
				...(extra?.duplicateCount !== undefined && { duplicateCount: extra.duplicateCount }),
				...(extra?.errorMessage !== undefined && { errorMessage: extra.errorMessage }),
				...(status === StatementReviewStatus.Applied && { appliedAt: new Date() })
			})
			.where(eq(statementReviews.id, reviewId));
	}

	async applyTransactions(
		userId: string,
		reviewId: string,
		transactions: { date: string; description: string; amount: number; category?: string }[]
	): Promise<ApplyResult> {
		const txService = new TransactionService(this.db);

		let inserted = 0;
		let duplicates = 0;

		for (const tx of transactions) {
			const [dateYear, dateMonth, dateDay] = tx.date.split('-').map(Number);
			const date = new Date(Date.UTC(dateYear, dateMonth - 1, dateDay));

			const result = await txService.insertFromPdf({
				userId,
				statementUploadId: reviewId,
				date,
				description: tx.description,
				amount: tx.amount,
				currency: Currency.BRL,
				category: tx.category || Category.Uncategorized
			});

			if (result.supersededBy) {
				duplicates++;
			} else {
				inserted++;
			}
		}

		await this.updateReviewStatus(reviewId, StatementReviewStatus.Applied, {
			transactionCount: inserted,
			duplicateCount: duplicates
		});

		return { inserted, duplicates };
	}

	async cancelReview(reviewId: string) {
		await this.updateReviewStatus(reviewId, StatementReviewStatus.Cancelled);
	}

	async getReviewById(reviewId: string, userId: string) {
		return this.db.query.statementReviews.findFirst({
			where: (reviews: any, { and, eq }: any) =>
				and(eq(reviews.id, reviewId), eq(reviews.userId, userId))
		});
	}

	async getReviewsByUser(userId: string) {
		return this.db.query.statementReviews.findMany({
			where: (reviews: any, { eq }: any) => eq(reviews.userId, userId),
			orderBy: (reviews: any, { desc }: any) => [desc(reviews.createdAt)]
		});
	}

	private detectFileType(file: File): FileType {
		const mime = file.type;
		const name = file.name.toLowerCase();
		if (mime === 'application/pdf' || name.endsWith('.pdf')) return FileType.Pdf;
		if (mime === 'text/csv' || name.endsWith('.csv')) return FileType.Csv;
		if (name.endsWith('.ofx')) return FileType.Ofx;
		return FileType.Pdf;
	}
}
