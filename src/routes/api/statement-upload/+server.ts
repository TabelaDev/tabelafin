import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { decryptSecret } from '$lib/server/crypto';
import {
	getCompletedUploadFilenames,
	insertStatementUpload,
	updateStatementUpload
} from '$lib/server/db/statement-uploads';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { extractTransactionsFromPdf } from '$lib/server/ai/extract';
import { modelSupportsDocuments, type AiProvider } from '$lib/utils/ai-providers';

// Upload ceiling: below the providers' document limits (32 MB at Anthropic, 50 MB
// per file at OpenAI), and comfortably above any real statement or invoice (most
// are a few hundred KB).
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

// Which statements already went through, so the bulk Takeout import can resume
// instead of re-running extractions the user has already paid for.
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) error(401, 'Não autenticado.');
	const db = getDb(platform!.env.DB);
	return json({ completed: await getCompletedUploadFilenames(db, locals.userId) });
};

// Manual ingestion fallback (ESCOPO.md §2.4): takes the PDF, sends it straight to
// the user's AI model (document understanding), stores the extracted and
// already-categorised transactions with source='pdf_upload', and discards the
// file — it is never persisted (no R2 in the MVP).
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.userId) error(401, 'Não autenticado.');

	const formData = await request.formData().catch(() => null);
	const file = formData?.get('file');
	if (!(file instanceof File)) error(400, 'Envie um arquivo PDF.');
	if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
		error(400, 'O arquivo precisa ser um PDF.');
	}
	if (file.size === 0) error(400, 'O arquivo está vazio.');
	if (file.size > MAX_PDF_BYTES) error(400, 'O PDF não pode passar de 10 MB.');

	const db = getDb(platform!.env.DB);
	const aiCredentials = await getAiCredentials(db, locals.userId);
	if (!aiCredentials) error(400, 'Configure sua IA antes de importar um PDF.');

	const provider = aiCredentials.provider as AiProvider;
	// Capability gating (ESCOPO.md §2.4): never swap the model out from under the
	// user — BYOK means they control cost and provider.
	if (!modelSupportsDocuments(provider, aiCredentials.model)) {
		error(
			400,
			`O modelo ${aiCredentials.model} não suporta upload de PDF. Escolha um modelo com suporte a documentos em Perfil → Categorização por IA.`
		);
	}

	const apiKey = await decryptSecret(
		platform!.env.MASTER_KEY,
		{
			ciphertext: aiCredentials.keyEncrypted,
			nonce: aiCredentials.nonce,
			v: aiCredentials.v ?? undefined
		},
		{ purpose: 'ai_credentials', userId: locals.userId }
	);

	const upload = await insertStatementUpload(db, { userId: locals.userId, filename: file.name });

	try {
		const userCategories = await getCategoriesByUser(db, locals.userId);
		const extracted = await extractTransactionsFromPdf({
			provider,
			model: aiCredentials.model,
			apiKey,
			categories: userCategories.map((c) => c.name),
			pdfBase64: arrayBufferToBase64(await file.arrayBuffer()),
			fileName: file.name
		});

		// Rows the sync already covers are inserted already superseded, so they
		// stay auditable without double-counting. Counted apart from `count` so
		// importing a month that was already synced reads as "nothing new" rather
		// than as a failure.
		let duplicates = 0;
		for (const tx of extracted) {
			const { supersededBy } = await locals.transactionService.insertFromPdf({
				userId: locals.userId,
				statementUploadId: upload.id,
				date: new Date(`${tx.date}T00:00:00.000Z`),
				description: tx.description,
				amount: tx.amount,
				currency: 'BRL',
				category: tx.category
			});
			if (supersededBy) duplicates += 1;
		}

		const imported = extracted.length - duplicates;

		await updateStatementUpload(db, upload.id, {
			status: 'completed',
			transactionCount: imported
		});

		return json({
			success: true,
			uploadId: upload.id,
			count: imported,
			duplicates,
			extracted: extracted.length
		});
	} catch (err) {
		// A failure at the AI provider or in the PDF's format: not a request error
		// (4xx) but a processing one (5xx) — recorded in statement_uploads for the
		// audit trail, with the message handed back so the user can retry.
		const message = err instanceof Error ? err.message : String(err);
		await updateStatementUpload(db, upload.id, { status: 'failed', errorMessage: message });
		error(502, message);
	}
};
