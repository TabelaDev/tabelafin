import type { ParsedTransaction, StatementParser } from '../types';
import { FileType } from '$lib/enums/file-type';

/**
 * Generic OFX parser. OFX is a standard banking format used by most Brazilian banks.
 *
 * Format:
 * <STMTTRN>
 *   <TRNTYPE>DEFERRED debit
 *   <DTPOSTED>20260103
 *   <TRNAMT>-9.72
 *   <MEMO>Transferência enviada pelo Pix - UBER
 *   <FITID>69599aaa-...
 * </STMTTRN>
 */
export const ofxParser: StatementParser = {
	bank: 'generic',
	formats: [FileType.Ofx],

	detect(text: string): boolean {
		return text.includes('<OFX>') && text.includes('<STMTTRN>');
	},

	parse(text: string): ParsedTransaction[] {
		const transactions: ParsedTransaction[] = [];
		const stmtRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
		let match;

		while ((match = stmtRegex.exec(text)) !== null) {
			const block = match[1];
			const dateStr = extractTag(block, 'DTPOSTED');
			const amountStr = extractTag(block, 'TRNAMT');
			const memo = extractTag(block, 'MEMO') ?? extractTag(block, 'NAME') ?? '';

			if (!dateStr || !amountStr) continue;

			// DTPOSTED format: YYYYMMDD or YYYYMMDDHHMMSS[.XXX:TZ]
			const cleanDate = dateStr.replace(/\[.*$/, '').slice(0, 8);
			if (cleanDate.length !== 8) continue;

			const year = cleanDate.slice(0, 4);
			const month = cleanDate.slice(4, 6);
			const day = cleanDate.slice(6, 8);

			const amount = Math.round(parseFloat(amountStr) * 100);
			if (isNaN(amount)) continue;

			transactions.push({
				date: `${year}-${month}-${day}`,
				description: memo.trim(),
				amount
			});
		}

		return transactions;
	}
};

function extractTag(block: string, tag: string): string | null {
	const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`);
	const match = regex.exec(block);
	return match?.[1]?.trim() ?? null;
}
