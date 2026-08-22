// Reads the PDFs out of a Google Takeout export of Gmail.
//
// Takeout is the only practical way to get a pile of statements out of Gmail
// without credentials: IMAP needs an app password (a flow no non-technical user
// gets through) and OAuth does not pay for itself on a one-off import. The
// trade-off is that the export is manual — there is no API to trigger one — so
// this is an import tool, not a sync channel.
//
// Everything here runs in the browser. The `.zip` holds a `.mbox` containing
// the full text of every matched email, not just its attachments, and there is
// no reason for any of that to reach the server: only the extracted PDFs are
// uploaded, one at a time, to the endpoint that already handles a single
// statement.

import { unzipSync } from 'fflate';
import PostalMime from 'postal-mime';
import { FileType } from '$lib/enums/file-type';

export interface TakeoutAttachment {
	/** Derived name, e.g. "nubank-2026-03.pdf" — see deriveFileName. */
	filename: string;
	/** Date header of the email the PDF arrived in. */
	receivedAt: Date;
	/** YYYY-MM of receivedAt, used to match against the sync window. */
	monthKey: string;
	subject: string;
	/** File type: pdf, csv, or ofx. */
	type: FileType;
	bytes: Uint8Array;
}

/**
 * Splits an mbox into its individual messages.
 *
 * The format separates messages with a "From " line at the start of a line.
 * A body line that would otherwise start with "From " is escaped as ">From ",
 * so an unescaped one is always a real boundary.
 */
export function splitMboxMessages(mbox: string): string[] {
	const messages: string[] = [];
	let current: string[] = [];

	for (const line of mbox.split('\n')) {
		if (line.startsWith('From ') && current.length > 0) {
			messages.push(current.join('\n'));
			current = [];
			continue;
		}
		// Drop the separator of the very first message too.
		if (line.startsWith('From ') && current.length === 0) continue;
		current.push(line);
	}

	if (current.length > 0) messages.push(current.join('\n'));
	return messages.filter((m) => m.trim().length > 0);
}

export function monthKeyOf(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Names the file after the month the statement arrived in, not after the
 * attachment's own name.
 *
 * Takeout hands back whatever the bank called it, which for a monthly statement
 * is the same generic string 29 times over. The name is what the user reads in
 * the review list and, more importantly, it is the key `statement_uploads`
 * records — so a repeated name would make an interrupted import unable to tell
 * which months already went through.
 */
export function deriveFileName(
	receivedAt: Date,
	index: number,
	taken: Set<string>,
	ext: FileType = FileType.Pdf
): string {
	const base = `nubank-${monthKeyOf(receivedAt)}`;
	let candidate = `${base}.${ext}`;
	// Two statements in one month do happen (account + card), so disambiguate
	// rather than letting one silently stand in for the other.
	let n = 2;
	while (taken.has(candidate)) {
		candidate = `${base}-${n}.${ext}`;
		n += 1;
		if (n > 50) {
			candidate = `${base}-${index}.${ext}`;
			break;
		}
	}
	taken.add(candidate);
	return candidate;
}

/** Finds the `.mbox` inside a Takeout zip. */
export function findMboxEntry(files: Record<string, Uint8Array>): Uint8Array | null {
	const name = Object.keys(files).find((f) => f.toLowerCase().endsWith('.mbox'));
	return name ? files[name] : null;
}

export class TakeoutParseError extends Error {}

export interface ExtractionProgress {
	current: number;
	total: number;
	filename: string;
}

export interface ExtractionOptions {
	onProgress?: (progress: ExtractionProgress) => void;
	signal?: AbortSignal;
}

/**
 * Checks if an attachment is a supported file type.
 */
function isSupportedAttachment(a: { mimeType?: string | null; filename?: string | null }): boolean {
	const mime = a.mimeType ?? '';
	const name = (a.filename ?? '').toLowerCase();
	return (
		mime === 'application/pdf' ||
		name.endsWith('.pdf') ||
		mime === 'text/csv' ||
		name.endsWith('.csv') ||
		mime === 'application/x-ofx' ||
		mime === 'application/ofx' ||
		name.endsWith('.ofx')
	);
}

/**
 * Determines the file type from mime or extension.
 */
function detectFileType(a: { mimeType?: string | null; filename?: string | null }): FileType {
	const mime = a.mimeType ?? '';
	const name = (a.filename ?? '').toLowerCase();
	if (mime === 'application/pdf' || name.endsWith('.pdf')) return FileType.Pdf;
	if (mime === 'text/csv' || name.endsWith('.csv')) return FileType.Csv;
	return FileType.Ofx;
}

/** Yield to the event loop between iterations so the UI stays responsive. */
function yieldToMain(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Extracts every supported attachment (PDF, CSV, OFX) from a Takeout zip,
 * ordered oldest first. Supports progress callbacks and cancellation.
 */
export async function extractPdfsFromTakeout(
	zip: ArrayBuffer,
	options?: ExtractionOptions
): Promise<TakeoutAttachment[]> {
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(new Uint8Array(zip));
	} catch {
		throw new TakeoutParseError('Não foi possível ler o arquivo — ele é um .zip do Takeout?');
	}

	const mbox = findMboxEntry(files);
	if (!mbox) {
		throw new TakeoutParseError(
			'Nenhum arquivo .mbox no zip. No Takeout, marque apenas "Mail" e filtre pelo label.'
		);
	}

	const messages = splitMboxMessages(new TextDecoder().decode(mbox));
	const taken = new Set<string>();
	const found: TakeoutAttachment[] = [];

	for (const [index, raw] of messages.entries()) {
		if (options?.signal?.aborted) {
			throw new TakeoutParseError('Importação cancelada pelo usuário.');
		}

		let parsed;
		try {
			parsed = await PostalMime.parse(raw);
		} catch {
			// One unreadable message should not sink the whole import.
			continue;
		}

		const supported = (parsed.attachments ?? []).filter(isSupportedAttachment);
		if (supported.length === 0) {
			if (options?.onProgress) {
				options.onProgress({
					current: index + 1,
					total: messages.length,
					filename: ''
				});
			}
			await yieldToMain();
			continue;
		}

		const receivedAt = parsed.date ? new Date(parsed.date) : new Date(NaN);
		if (Number.isNaN(receivedAt.getTime())) continue;

		for (const attachment of supported) {
			const bytes =
				attachment.content instanceof ArrayBuffer
					? new Uint8Array(attachment.content)
					: new TextEncoder().encode(String(attachment.content));
			const type = detectFileType(attachment);
			const filename = deriveFileName(receivedAt, index, taken, type);
			found.push({
				filename,
				receivedAt,
				monthKey: monthKeyOf(receivedAt),
				subject: parsed.subject ?? '',
				type,
				bytes
			});

			if (options?.onProgress) {
				options.onProgress({
					current: index + 1,
					total: messages.length,
					filename
				});
			}
		}

		// Yield to the event loop every message to keep the UI responsive
		await yieldToMain();
	}

	return found.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
}
