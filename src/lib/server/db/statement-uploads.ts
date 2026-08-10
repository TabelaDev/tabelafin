// Uploads de PDF de fatura/extrato (fallback manual, ESCOPO.md §2.4/§4): o
// arquivo em si nunca é persistido — só o registro do processamento e o
// resultado estruturado nas transações vinculadas via statement_upload_id.
import { eq } from 'drizzle-orm';
import type { getDb } from './index';
import { statementUploads } from './schema';

type Db = ReturnType<typeof getDb>;

export interface NewStatementUploadInput {
	userId: string;
	filename: string;
}

export async function insertStatementUpload(db: Db, input: NewStatementUploadInput) {
	const [saved] = await db
		.insert(statementUploads)
		.values({ userId: input.userId, filename: input.filename, status: 'processing' })
		.returning();
	return saved;
}

export interface UpdateStatementUploadInput {
	status: 'completed' | 'failed';
	errorMessage?: string | null;
	transactionCount?: number;
}

export async function updateStatementUpload(
	db: Db,
	id: string,
	input: UpdateStatementUploadInput
): Promise<void> {
	await db.update(statementUploads).set(input).where(eq(statementUploads.id, id));
}
