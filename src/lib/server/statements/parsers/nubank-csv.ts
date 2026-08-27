import { FileType } from '$lib/enums/file-type';

import type { ParsedTransaction, StatementParser } from '../types';

/**
 * Parser for Nubank CSV exports.
 *
 * Format:
 * Data,Valor,Identificador,Descrição
 * 03/01/2026,300.00,69599362-...,Resgate RDB
 *
 * Date: DD/MM/YYYY
 * Amount: positive = income, negative = expense
 * Decimal separator: dot (.)
 */
export const nubankCsvParser: StatementParser = {
	bank: 'nubank',
	formats: [FileType.Csv],

	detect(text: string): boolean {
		const firstLine = text.split('\n')[0]?.trim() ?? '';
		return firstLine === 'Data,Valor,Identificador,Descrição';
	},

	parse(text: string): ParsedTransaction[] {
		const lines = text.split('\n').filter((l) => l.trim());
		const transactions: ParsedTransaction[] = [];

		// Skip header
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			const [dateStr, amountStr, , description] = parseCsvLine(line);
			if (!dateStr || !amountStr || !description) continue;

			const [day, month, year] = dateStr.split('/');
			if (!day || !month || !year) continue;

			const amount = Math.round(parseFloat(amountStr) * 100);
			if (isNaN(amount)) continue;

			transactions.push({
				date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
				description: description.trim(),
				amount
			});
		}

		return transactions;
	}
};

/**
 * Parses a single CSV line, handling quoted fields with commas.
 */
function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			result.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	result.push(current);
	return result;
}
