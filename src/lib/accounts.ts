// Sign convention for account balances.
//
// The API reports a credit card's cachedBalance as the open invoice — a debt,
// stored as a POSITIVE number — while every other account type reports its
// balance directly. Reading cachedBalance raw therefore makes a card look like
// money you have: it inflated the "Saldo total", painted the debt green in the
// accounts table, and let the card outrank real accounts when sorting by
// balance. Anything that treats a balance as a number on the same axis as the
// others has to go through here first.
//
// Lives in $lib (not $lib/server) because the accounts table and the dashboard
// both need it while rendering.

export interface AccountBalance {
	type: string;
	cachedBalance: number;
}

export function signedBalance(account: AccountBalance): number {
	return account.type === 'credit_card' ? -account.cachedBalance : account.cachedBalance;
}

// Sums balances on the signed axis, rounded to cents so the float noise from
// adding many values does not surface in the UI.
export function sumSignedBalance(accounts: AccountBalance[]): number {
	return Math.round(accounts.reduce((sum, a) => sum + signedBalance(a), 0) * 100) / 100;
}
