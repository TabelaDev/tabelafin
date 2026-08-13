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

export interface TakeoutAttachment {
	/** Derived name, e.g. "nubank-2026-03.pdf" — see deriveFileName. */
	filename: string;
	/** Date header of the email the PDF arrived in. */
	receivedAt: Date;
	/** YYYY-MM of receivedAt, used to match against the sync window. */
	monthKey: string;
	subject: string;
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
export function deriveFileName(receivedAt: Date, index: number, taken: Set<string>): string {
	const base = `nubank-${monthKeyOf(receivedAt)}`;
	let candidate = `${base}.pdf`;
	// Two statements in one month do happen (account + card), so disambiguate
	// rather than letting one silently stand in for the other.
	let n = 2;
	while (taken.has(candidate)) {
		candidate = `${base}-${n}.pdf`;
		n += 1;
		if (n > 50) {
			candidate = `${base}-${index}.pdf`;
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

/**
 * Extracts every PDF attachment from a Takeout zip, ordered oldest first.
 */
export async function extractPdfsFromTakeout(zip: ArrayBuffer): Promise<TakeoutAttachment[]> {
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
		let parsed;
		try {
			parsed = await PostalMime.parse(raw);
		} catch {
			// One unreadable message should not sink the whole import.
			continue;
		}

		const pdfs = (parsed.attachments ?? []).filter(
			(a) => a.mimeType === 'application/pdf' || (a.filename ?? '').toLowerCase().endsWith('.pdf')
		);
		if (pdfs.length === 0) continue;

		const receivedAt = parsed.date ? new Date(parsed.date) : new Date(NaN);
		if (Number.isNaN(receivedAt.getTime())) continue;

		for (const pdf of pdfs) {
			const bytes =
				pdf.content instanceof ArrayBuffer
					? new Uint8Array(pdf.content)
					: new TextEncoder().encode(String(pdf.content));
			found.push({
				filename: deriveFileName(receivedAt, index, taken),
				receivedAt,
				monthKey: monthKeyOf(receivedAt),
				subject: parsed.subject ?? '',
				bytes
			});
		}
	}

	return found.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
}
