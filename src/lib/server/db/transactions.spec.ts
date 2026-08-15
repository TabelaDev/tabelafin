import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import {
	amountsMatchForDedupe,
	classifyMovement,
	isWithinSupersedeWindow,
	renameCategoryOnTransactions
} from './transactions';

// A drizzle instance that executes nothing and records the SQL it would have
// sent. Enough to assert which rows a statement can reach, which is the part
// that matters for tenant isolation.
function recordingDb() {
	const statements: { sql: string; params: unknown[] }[] = [];
	const db = drizzle(async (sql, params) => {
		statements.push({ sql, params });
		return { rows: [] };
	});
	return {
		db: db as unknown as Parameters<typeof renameCategoryOnTransactions>[0],
		statements
	};
}

// The rule that decides whether a row extracted from a statement PDF is already
// covered by something the user has. Getting it wrong in either direction is
// expensive: too loose hides real transactions, too strict double-counts an
// entire imported month.
describe('amountsMatchForDedupe', () => {
	it('matches identical amounts', () => {
		expect(amountsMatchForDedupe(-782.54, -782.54)).toBe(true);
	});

	// The PDF extractor writes an expense as negative; the API reports a credit
	// card purchase as positive. Comparing exact values missed every card
	// duplicate, which is most of them.
	it('matches across the credit-card sign inversion', () => {
		expect(amountsMatchForDedupe(-782.54, 782.54)).toBe(true);
	});

	it('does not match different amounts', () => {
		expect(amountsMatchForDedupe(-782.54, -782.55)).toBe(false);
	});

	it('does not match on magnitude alone when the values differ', () => {
		expect(amountsMatchForDedupe(-100, -1000)).toBe(false);
	});
});

describe('isWithinSupersedeWindow', () => {
	const base = new Date('2026-03-15T00:00:00.000Z');

	it('accepts the same day', () => {
		expect(isWithinSupersedeWindow(base, new Date('2026-03-15T23:00:00.000Z'))).toBe(true);
	});

	it('accepts three days apart, in both directions', () => {
		expect(isWithinSupersedeWindow(base, new Date('2026-03-18T00:00:00.000Z'))).toBe(true);
		expect(isWithinSupersedeWindow(base, new Date('2026-03-12T00:00:00.000Z'))).toBe(true);
	});

	it('rejects four days apart', () => {
		expect(isWithinSupersedeWindow(base, new Date('2026-03-19T00:00:00.000Z'))).toBe(false);
		expect(isWithinSupersedeWindow(base, new Date('2026-03-11T00:00:00.000Z'))).toBe(false);
	});
});

// The shared spending/income split — the rule that decides whether a transaction
// is a gasto or a receita. Credit cards invert the sign, so a plain `amount < 0`
// check counts every card purchase as income (the bug this helper fixes).
describe('classifyMovement', () => {
	it('checking account: negative is expense (reported positive)', () => {
		expect(classifyMovement('checking', -782.54)).toEqual({ expense: 782.54, income: 0 });
	});

	it('checking account: positive is income', () => {
		expect(classifyMovement('checking', 2000)).toEqual({ expense: 0, income: 2000 });
	});

	it('credit card: positive purchase is spending, not income', () => {
		expect(classifyMovement('credit_card', 782.54)).toEqual({ expense: 782.54, income: 0 });
	});

	// A R$10 purchase followed by its R$10 estorno nets to zero spending — the
	// refund must not show up as income ("receita").
	it('credit card: a refund nets against the purchase', () => {
		expect(classifyMovement('credit_card', -10)).toEqual({ expense: -10, income: 0 });
	});

	// A checking expense (-100) and a card purchase (+100) are BOTH R$100 of
	// spending — summed they must not cancel out.
	it('checking and card spending add up (uniform expense sign)', () => {
		const checking = classifyMovement('checking', -100).expense;
		const card = classifyMovement('credit_card', 100).expense;
		expect(checking + card).toBe(200);
	});

	it('no account (manual/PDF): checking convention', () => {
		expect(classifyMovement(undefined, -25)).toEqual({ expense: 25, income: 0 });
		expect(classifyMovement(null, 50)).toEqual({ expense: 0, income: 50 });
	});

	it('zero contributes nothing on either axis', () => {
		expect(classifyMovement('checking', 0)).toEqual({ expense: 0, income: 0 });
		expect(classifyMovement('credit_card', 0)).toEqual({ expense: 0, income: 0 });
	});
});

// Category names are per-user, not global: two people can both have "Mercado".
// The rename used to run `WHERE category = ?` with no owner, so renaming one
// user's category rewrote every other user's matching transactions.
describe('renameCategoryOnTransactions', () => {
	it('filters by owner as well as by the old category name', async () => {
		const { db, statements } = recordingDb();

		await renameCategoryOnTransactions(db, 'user-a', 'Mercado', 'Supermercado');

		expect(statements).toHaveLength(1);
		expect(statements[0].sql).toContain('"user_id"');
		expect(statements[0].params).toEqual(['Supermercado', 'user-a', 'Mercado']);
	});

	it('never emits an update reaching rows it cannot attribute to the user', async () => {
		const { db, statements } = recordingDb();

		await renameCategoryOnTransactions(db, 'user-a', 'Mercado', 'Supermercado');

		// The owner predicate has to be part of the WHERE, not merely a parameter
		// that happens to be passed: an update whose WHERE only mentions the
		// category would match other users' rows.
		const where = statements[0].sql.slice(statements[0].sql.indexOf('where'));
		expect(where).toContain('"user_id"');
		expect(where).toContain('"category"');
	});
});
