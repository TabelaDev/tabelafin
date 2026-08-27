import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
	TakeoutParseError,
	deriveFileName,
	extractPdfsFromTakeout,
	findMboxEntry,
	monthKeyOf,
	splitMboxMessages
} from './takeout-mbox';

// A minimal PDF is enough — nothing here parses the document, it only has to
// survive base64 round-tripping through the MIME layer intact.
const PDF_BYTES = '%PDF-1.4\nminimal\n%%EOF';
const PDF_B64 = Buffer.from(PDF_BYTES, 'utf8').toString('base64');

function message(opts: { date: string; subject: string; withPdf: boolean }): string {
	const head = [
		'From nobody@example.com Mon Mar 16 00:00:00 2026',
		'From: Nubank <todomundo@nubank.com.br>',
		`Subject: ${opts.subject}`,
		`Date: ${opts.date}`,
		'MIME-Version: 1.0'
	];

	if (!opts.withPdf) {
		return [...head, 'Content-Type: text/plain; charset=utf-8', '', 'Sem anexo aqui.', ''].join(
			'\n'
		);
	}

	return [
		...head,
		'Content-Type: multipart/mixed; boundary="BOUND"',
		'',
		'--BOUND',
		'Content-Type: text/plain; charset=utf-8',
		'',
		'Segue o extrato.',
		'',
		'--BOUND',
		'Content-Type: application/pdf; name="extrato.pdf"',
		'Content-Disposition: attachment; filename="extrato.pdf"',
		'Content-Transfer-Encoding: base64',
		'',
		PDF_B64,
		'',
		'--BOUND--',
		''
	].join('\n');
}

function takeoutZip(messages: string[]): ArrayBuffer {
	const mbox = messages.join('\n');
	const zipped = zipSync({ 'Takeout/Mail/Nubank-Extratos.mbox': strToU8(mbox) });
	return zipped.buffer.slice(
		zipped.byteOffset,
		zipped.byteOffset + zipped.byteLength
	) as ArrayBuffer;
}

describe('splitMboxMessages', () => {
	it('splits on the "From " separator', () => {
		const mbox = [
			'From a@b Mon Mar 16 00:00:00 2026',
			'Subject: um',
			'',
			'From c@d Tue Apr 16 00:00:00 2026',
			'Subject: dois',
			''
		].join('\n');
		const parts = splitMboxMessages(mbox);
		expect(parts).toHaveLength(2);
		expect(parts[0]).toContain('Subject: um');
		expect(parts[1]).toContain('Subject: dois');
	});

	it('keeps an escaped ">From " body line inside its message', () => {
		const mbox = [
			'From a@b Mon Mar 16 00:00:00 2026',
			'Subject: um',
			'',
			'>From aqui em diante segue o corpo',
			''
		].join('\n');
		expect(splitMboxMessages(mbox)).toHaveLength(1);
	});

	it('returns nothing for an empty mbox', () => {
		expect(splitMboxMessages('')).toEqual([]);
	});
});

describe('deriveFileName', () => {
	it('names the file after the month the statement arrived in', () => {
		const taken = new Set<string>();
		expect(deriveFileName(new Date('2026-03-16T10:00:00Z'), 0, taken)).toBe('nubank-2026-03.pdf');
	});

	// Account statement and card invoice can both land in the same month, and
	// statement_uploads keys on this name to know what already went through.
	it('disambiguates a second statement in the same month', () => {
		const taken = new Set<string>();
		const first = deriveFileName(new Date('2026-03-16T10:00:00Z'), 0, taken);
		const second = deriveFileName(new Date('2026-03-20T10:00:00Z'), 1, taken);
		expect(first).toBe('nubank-2026-03.pdf');
		expect(second).toBe('nubank-2026-03-2.pdf');
	});
});

describe('monthKeyOf', () => {
	it('pads the month', () => {
		expect(monthKeyOf(new Date(2026, 2, 16))).toBe('2026-03');
	});
});

describe('findMboxEntry', () => {
	it('finds the mbox regardless of its folder', () => {
		const files = {
			'Takeout/archive_browser.html': new Uint8Array([1]),
			'Takeout/Mail/Nubank.mbox': new Uint8Array([2])
		};
		expect(findMboxEntry(files)).toEqual(new Uint8Array([2]));
	});

	it('returns null when there is none', () => {
		expect(findMboxEntry({ 'Takeout/notas.txt': new Uint8Array([1]) })).toBeNull();
	});
});

describe('extractPdfsFromTakeout', () => {
	it('extracts one attachment per message that carries a PDF', async () => {
		const zip = takeoutZip([
			message({ date: 'Mon, 16 Mar 2026 10:00:00 -0300', subject: 'Extrato março', withPdf: true }),
			message({ date: 'Thu, 16 Apr 2026 10:00:00 -0300', subject: 'Sem anexo', withPdf: false }),
			message({ date: 'Sat, 16 May 2026 10:00:00 -0300', subject: 'Extrato maio', withPdf: true })
		]);

		const found = await extractPdfsFromTakeout(zip);

		expect(found).toHaveLength(2);
		expect(found.map((f) => f.filename)).toEqual(['nubank-2026-03.pdf', 'nubank-2026-05.pdf']);
		expect(found.map((f) => f.monthKey)).toEqual(['2026-03', '2026-05']);
		expect(new TextDecoder().decode(found[0].bytes)).toBe(PDF_BYTES);
	});

	it('orders the statements oldest first', async () => {
		const zip = takeoutZip([
			message({ date: 'Sat, 16 May 2026 10:00:00 -0300', subject: 'maio', withPdf: true }),
			message({ date: 'Mon, 16 Mar 2026 10:00:00 -0300', subject: 'março', withPdf: true })
		]);

		const found = await extractPdfsFromTakeout(zip);
		expect(found.map((f) => f.monthKey)).toEqual(['2026-03', '2026-05']);
	});

	it('explains itself when the zip holds no mbox', async () => {
		const zipped = zipSync({ 'Takeout/notas.txt': strToU8('nada aqui') });
		const buffer = zipped.buffer.slice(
			zipped.byteOffset,
			zipped.byteOffset + zipped.byteLength
		) as ArrayBuffer;
		await expect(extractPdfsFromTakeout(buffer)).rejects.toBeInstanceOf(TakeoutParseError);
	});

	it('explains itself when the file is not a zip', async () => {
		const notAZip = strToU8('isto nao e um zip');
		const buffer = notAZip.buffer.slice(
			notAZip.byteOffset,
			notAZip.byteOffset + notAZip.byteLength
		) as ArrayBuffer;
		await expect(extractPdfsFromTakeout(buffer)).rejects.toBeInstanceOf(TakeoutParseError);
	});
});
