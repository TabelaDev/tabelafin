// Statement/invoice PDF uploads (manual fallback, ESCOPO.md §2.4/§4): the file
// itself is never persisted — only the record of the processing and the
// structured result, on the transactions linked through statement_upload_id.
import { and, eq } from 'drizzle-orm';

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

// Filenames already imported, so a bulk import can pick up where it left off.
// A queue of statements takes tens of minutes — one AI extraction per file —
// and a reload in the middle would otherwise mean starting over and paying for
// every extraction a second time.
export async function getCompletedUploadFilenames(db: Db, userId: string): Promise<string[]> {
	const rows = await db
		.select({ filename: statementUploads.filename })
		.from(statementUploads)
		.where(and(eq(statementUploads.userId, userId), eq(statementUploads.status, 'completed')));
	return [...new Set(rows.map((r) => r.filename))];
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
