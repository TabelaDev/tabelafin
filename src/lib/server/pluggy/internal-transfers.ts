// Meu Pluggy API categories that stand for the user moving their own money
// around — movement that is NOT spending and NOT income: putting money into or
// taking it out of an investment, paying the card invoice (the spending already
// landed as the card purchase), transferring between accounts of the same owner.
//
// They come from `transactions.pluggy_category` (the API's raw `category`
// field). Confirmed against my-api.pluggy.ai on 2026-08-09 (a real checking +
// brokerage account).
//
// Note: the generic `Transfers` is deliberately NOT here — at some banks it also
// covers genuine instalment purchases ("Dio 12/12", "Plano NuCel"), which are
// real spending and have to stay on the dashboard.
export const INTERNAL_TRANSFER_CATEGORIES = new Set([
	'Investments', // money into or out of an investment
	'Fixed income', // money into a CDB/fixed-income product
	'Third party transfers', // investment withdrawal ("Valor recebido de Investimentos")
	'Same person transfer', // between accounts of the same owner
	'Credit card payment', // invoice payment (would double-count the card purchase)
	'Internal transfer' // flagged by the app: mirrored between the user's own accounts
]);

// Descriptions that mark an internal transfer even when the API category is the
// generic "Transfers". Some banks post the invoice payment as "Pagamento de
// fatura" on the checking account (category "Transfers") and as "Pagamento
// recebido" on the card (category "Credit card payment", already excluded
// above). Without this the same spending lands twice: once as the card purchase
// and once as the
// payment.
export const INTERNAL_TRANSFER_DESCRIPTIONS = new Set([
	'Pagamento de fatura',
	'Pagamento recebido'
]);

export function isInternalTransfer(
	pluggyCategory: string | null | undefined,
	description?: string | null
): boolean {
	const byCategory =
		pluggyCategory !== null && pluggyCategory !== undefined
			? INTERNAL_TRANSFER_CATEGORIES.has(pluggyCategory)
			: false;
	if (byCategory) return true;
	return description ? INTERNAL_TRANSFER_DESCRIPTIONS.has(description) : false;
}

// Lowercase, strip accents, collapse whitespace — the way the user's full name
// appears on the bank side varies in case ("IAN PATRICK DA COSTA SOARES" vs
// "Ian Patrick da Costa Soares") and occasionally accents.
export function normalizeName(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

// A transaction is a self-transfer (moving money between the user's own
// accounts) when the description names the user themselves as the counterparty.
// Pluggy usually labels those "Same person transfer", but sometimes the generic
// "Transfers"/"Transfer - PIX" leaks through and would count as income. The full
// legal name is specific enough that a substring match has ~no false positives.
export function isSelfTransferByDescription(description: string | null, fullName: string): boolean {
	if (!description) return false;
	const name = normalizeName(fullName);
	if (!name) return false;
	return normalizeName(description).includes(name);
}
