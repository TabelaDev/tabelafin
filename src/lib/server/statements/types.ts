import { FileType } from '$lib/enums/file-type';

export interface ParsedTransaction {
	date: string; // YYYY-MM-DD
	description: string;
	amount: number; // centavos (negative = expense, positive = income)
	category?: string;
}

export interface StatementParser {
	bank: string;
	formats: FileType[];
	detect(text: string): boolean;
	parse(text: string): ParsedTransaction[];
}
