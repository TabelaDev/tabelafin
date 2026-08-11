import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getAiCredentials } from '$lib/server/db/ai-credentials';
import { decryptSecret } from '$lib/server/crypto';
import { insertStatementUpload, updateStatementUpload } from '$lib/server/db/statement-uploads';
import { insertPdfTransaction } from '$lib/server/db/transactions';
import { getCategoriesByUser } from '$lib/server/db/user-categories';
import { extractTransactionsFromPdf } from '$lib/server/ai/extract';
import { modelSupportsDocuments, type AiProvider } from '$lib/ai-providers';

// Teto do upload: abaixo dos limites de documento dos providers (32 MB na
// Anthropic, 50 MB por arquivo na OpenAI), mas seguro o bastante pra qualquer
// fatura/extrato real (a maioria tem poucas centenas de KB).
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

// Fallback manual de ingestão (ESCOPO.md §2.4): recebe o PDF, envia direto pro
// modelo de IA do usuário (document understanding), salva as transações
// extraídas + já categorizadas com source='pdf_upload' e descarta o arquivo —
// nunca é persistido (sem R2 no MVP).
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
	// Capability gating (ESCOPO.md §2.4): nunca trocar de modelo por baixo dos
	// panos — BYOK significa que o usuário controla custo/provedor.
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

		for (const tx of extracted) {
			await insertPdfTransaction(db, {
				userId: locals.userId,
				statementUploadId: upload.id,
				date: new Date(`${tx.date}T00:00:00.000Z`),
				description: tx.description,
				amount: tx.amount,
				currency: 'BRL',
				category: tx.category
			});
		}

		await updateStatementUpload(db, upload.id, {
			status: 'completed',
			transactionCount: extracted.length
		});

		return json({ success: true, uploadId: upload.id, count: extracted.length });
	} catch (err) {
		// Falha no provider de IA ou no formato do PDF: não é erro do request
		// (4xx), é falha do processamento (5xx) — registra no statement_uploads
		// pra auditoria e devolve a mensagem pro usuário tentar de novo.
		const message = err instanceof Error ? err.message : String(err);
		await updateStatementUpload(db, upload.id, { status: 'failed', errorMessage: message });
		error(502, message);
	}
};
