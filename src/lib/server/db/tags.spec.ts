import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { getTagsForTransactions, setTransactionTags } from './tags';

// A drizzle instance that records the SQL it would have sent, with a pluggable
// answer for the ownership SELECT — enough to assert the delete+insert shape of
// setTransactionTags and that a foreign transaction id never reaches it.
function recordingDb(ownsTransaction: boolean) {
	const statements: { sql: string; params: unknown[] }[] = [];
	const db = drizzle(async (sql, params) => {
		statements.push({ sql, params });
		if (sql.includes('from "transactions"') || sql.includes('from `transactions`')) {
			return {
				rows: ownsTransaction ? [{ id: 'tx-1' }] : []
			};
		}
		// Any other select (tags lookup) returns a fake existing tag so
		// getOrCreateTag takes the fast path and the test focuses on the junction.
		if (sql.includes('from "tags"') || sql.includes('from `tags`')) {
			return { rows: [{ id: 'tag-1', name: 'x' }] };
		}
		return { rows: [] };
	});
	return {
		db: db as unknown as Parameters<typeof setTransactionTags>[0],
		statements
	};
}

describe('setTransactionTags', () => {
	it('checks ownership before touching any link (foreign transaction id)', async () => {
		const { db, statements } = recordingDb(false);
		await setTransactionTags(db, 'user-a', 'someone-elses-tx', ['Viagem SP']);
		// Only the ownership SELECT runs — no DELETE or INSERT on the junction.
		expect(statements).toHaveLength(1);
		expect(statements[0].sql.toLowerCase()).toContain('transactions');
		expect(statements[0].sql.toLowerCase()).toContain('"user_id"');
	});

	it('replaces the old tag links: deletes the junction rows, then inserts the new ones', async () => {
		const { db, statements } = recordingDb(true);
		await setTransactionTags(db, 'user-a', 'tx-1', ['Viagem SP', 'PC novo']);

		const deletes = statements.filter((s) => s.sql.trimStart().toLowerCase().startsWith('delete'));
		expect(deletes).toHaveLength(1);
		expect(deletes[0].sql).toContain('transaction_tags');

		const inserts = statements.filter((s) => s.sql.trimStart().toLowerCase().startsWith('insert'));
		expect(inserts).toHaveLength(1);
		expect(inserts[0].sql).toContain('transaction_tags');
		// Both resolved tags land in the same multi-row INSERT.
		expect(inserts[0].sql.toLowerCase()).toContain('transaction_id');
		expect(inserts[0].sql.toLowerCase()).toContain('tag_id');
	});
});

// The list page hands every transaction the user has (hundreds of ids) to
// getTagsForTransactions; D1 caps bind params per statement, so the IN clause
// must be chunked or the page 500s.
describe('getTagsForTransactions', () => {
	it('splits a large id list into chunked queries', async () => {
		const statements: { sql: string; params: unknown[] }[] = [];
		const db = drizzle(async (sql, params) => {
			statements.push({ sql, params });
			return { rows: [] };
		});
		const ids = Array.from({ length: 200 }, (_, i) => `tx-${i}`);

		await getTagsForTransactions(
			db as unknown as Parameters<typeof getTagsForTransactions>[0],
			ids
		);

		const selects = statements.filter((s) => s.sql.includes('transaction_tags'));
		expect(selects).toHaveLength(Math.ceil(200 / 90));
		selects.forEach((s) => expect(s.params.length).toBeLessThanOrEqual(90));
	});
});
