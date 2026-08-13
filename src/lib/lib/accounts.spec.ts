import { describe, expect, it } from 'vitest';
import { signedBalance, sumSignedBalance } from './accounts';

const checking = { type: 'checking', cachedBalance: 1271.09 };
const investment = { type: 'investment', cachedBalance: 24408.29 };
const card = { type: 'credit_card', cachedBalance: 6374.34 };

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
		expect(signedBalance({ type: 'credit_card', cachedBalance: -120.5 })).toBe(120.5);
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

	it('rounds the accumulated float noise to cents', () => {
		expect(
			sumSignedBalance([
				{ type: 'checking', cachedBalance: 0.1 },
				{ type: 'checking', cachedBalance: 0.2 }
			])
		).toBe(0.3);
	});
});
