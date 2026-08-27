import { nubankCsvParser } from './parsers/nubank-csv';
import { ofxParser } from './parsers/ofx';
import type { ParsedTransaction, StatementParser } from './types';

export type { ParsedTransaction, StatementParser } from './types';

const parsers: StatementParser[] = [nubankCsvParser, ofxParser];

/**
 * Detects which parser can handle the given content.
 * Tries each parser's `detect()` in order.
 * Returns null if no parser matches (use AI fallback).
 */
export function detectParser(text: string, bankHint?: string): StatementParser | null {
	if (bankHint && bankHint !== 'auto') {
		const match = parsers.find((p) => p.bank === bankHint);
		if (match?.detect(text)) return match;
	}

	return parsers.find((p) => p.detect(text)) ?? null;
}

/**
 * Parses the given content using the appropriate parser.
 * Falls back to AI extraction if no parser matches.
 */
export function parseWithParser(text: string, bankHint?: string): ParsedTransaction[] | null {
	const parser = detectParser(text, bankHint);
	if (!parser) return null;
	return parser.parse(text);
}

/**
 * Returns all available parsers (for UI display).
 */
export function getAvailableParsers(): { bank: string; formats: string[] }[] {
	return parsers.map((p) => ({ bank: p.bank, formats: p.formats }));
}
