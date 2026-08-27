import { AccountType } from '$lib/enums/account-type';

import { describe, expect, it } from 'vitest';

import { signedBalance, sumSignedBalance } from './accounts';

const checking = { type: AccountType.Checking, cachedBalance: 1271.09 };
const investment = { type: AccountType.Investment, cachedBalance: 24408.29 };
const card = { type: AccountType.CreditCard, cachedBalance: 6374.34 };

describe('signedBalance', () => {
	it('passes a checking balance through untouched', () => {
		expect(signedBalance(checking)).toBe(1271.09);
	});

	it('passes an investment balance through untouched', () => {
		expect(signedBalance(investment)).toBe(24408.29);
	});

	// The card reports its open invoice as a positive number, which is a debt.
	it('flips a credit card balance to negative', () => {
		expect(signedBalance(card)).toBe(-6374.34);
	});

	it('keeps a credit card refund positive', () => {
		expect(signedBalance({ type: AccountType.CreditCard, cachedBalance: -120.5 })).toBe(120.5);
	});
});

describe('sumSignedBalance', () => {
	// The bug this replaces: the total added the card's debt to the balance,
	// reporting 32.053,72 where the user actually has 19.305,04.
	it('subtracts card debt from the total instead of adding it', () => {
		expect(sumSignedBalance([checking, investment, card])).toBe(19305.04);
	});

	it('returns zero for no accounts', () => {
		expect(sumSignedBalance([])).toBe(0);
	});

	// This used to assert that the helper *rounded away* float drift, because
	// balances were reais in a `real` column. They are integer centavos now, so
	// the sum is exact by construction — what matters is that no rounding sneaks
	// back in and shifts a value.
	it('sums exactly, without rounding', () => {
		expect(
			sumSignedBalance([
				{ type: AccountType.Checking, cachedBalance: 10 },
				{ type: AccountType.Checking, cachedBalance: 20 }
			])
		).toBe(30);
	});

	it('stays exact across many small balances', () => {
		const accounts = Array.from({ length: 1000 }, () => ({
			type: AccountType.Checking,
			cachedBalance: 7
		}));
		expect(sumSignedBalance(accounts)).toBe(7000);
	});
});
