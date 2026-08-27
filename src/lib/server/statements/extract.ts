import { FileType } from '$lib/enums/file-type';
import { extractTransactionsFromPdf } from '$lib/server/ai/extract';
import { decryptSecret } from '$lib/server/crypto';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { findUserById } from '$lib/server/db/users';
import type { AiProvider } from '$lib/utils/ai-providers';

import { parseWithParser } from './index';
import type { ParsedTransaction } from './types';

export interface ExtractInput {
	userId: string;
	platform: { env: { DB: D1Database; MASTER_KEY: string } };
	fileContent: string;
	fileType: FileType;
	bankHint?: string;
}

export interface ExtractResult {
	transactions: ParsedTransaction[];
	method: 'parser' | 'ai';
}

/**
 * Extracts transactions from a file.
 * Tries parser first, falls back to AI for PDFs.
 */
export async function extractTransactions(input: ExtractInput): Promise<ExtractResult> {
	const { userId, platform, fileContent, fileType, bankHint } = input;

	// For CSV/OFX, try parser first
	if (fileType === FileType.Csv || fileType === FileType.Ofx) {
		const parsed = parseWithParser(fileContent, bankHint);
		if (parsed) {
			return { transactions: parsed, method: 'parser' };
		}
		throw new Error(`Não foi possível analisar o arquivo ${fileType.toUpperCase()}.`);
	}

	// For PDF, try parser first (future: bank-specific PDF parsers)
	const parsed = parseWithParser(fileContent, bankHint);
	if (parsed) {
		return { transactions: parsed, method: 'parser' };
	}

	// Fallback to AI extraction for PDF
	const db = getDb(platform.env.DB);
	const user = await findUserById(db, userId);
	if (!user) throw new Error('Usuário não encontrado.');

	const creds = await getAiCredentials(db, userId);
	if (!creds) throw new Error('Configure uma chave de API de IA antes de importar.');

	const apiKey = await decryptSecret(
		platform.env.MASTER_KEY,
		{
			ciphertext: creds.keyEncrypted,
			nonce: creds.nonce,
			v: creds.v ?? undefined
		},
		{ purpose: 'ai_credentials', userId }
	);

	const categories = await db.query.userCategories
		.findMany({ where: (cats, { eq }) => eq(cats.userId, userId) })
		.then((rows) => rows.map((r) => r.name));

	const aiTransactions = await extractTransactionsFromPdf({
		pdfBase64: fileContent,
		apiKey,
		provider: creds.provider as AiProvider,
		model: creds.model,
		categories,
		fileName: 'statement.pdf'
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
