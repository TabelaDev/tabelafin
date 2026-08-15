import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { setTagRulesForDescription } from './tag-rules';

// A drizzle instance that records the SQL it would have sent — enough to assert
// the replace semantics of a description's rule set.
function recordingDb() {
	const statements: { sql: string }[] = [];
	const db = drizzle(async (sql) => {
		statements.push({ sql });
		return { rows: [] };
	});
	return {
		db: db as unknown as Parameters<typeof setTagRulesForDescription>[0],
		statements
	};
}

describe('setTagRulesForDescription', () => {
	it('drops the old rules for the description before inserting the new ones', async () => {
		const { db, statements } = recordingDb();
		await setTagRulesForDescription(db, 'user-a', 'Uber', ['Viagem SP', 'PC novo']);

		const deletes = statements.filter((s) => s.sql.trimStart().toLowerCase().startsWith('delete'));
		expect(deletes).toHaveLength(1);
		expect(deletes[0].sql).toContain('tag_rules');

		const inserts = statements.filter((s) => s.sql.trimStart().toLowerCase().startsWith('insert'));
		expect(inserts).toHaveLength(1);
		expect(inserts[0].sql).toContain('tag_rules');
	});

	it('only deletes when the tag list is empty (no orphan insert)', async () => {
		const { db, statements } = recordingDb();
		await setTagRulesForDescription(db, 'user-a', 'Uber', []);

		const deletes = statements.filter((s) => s.sql.trimStart().toLowerCase().startsWith('delete'));
		expect(deletes).toHaveLength(1);
		const inserts = statements.filter((s) => s.sql.trimStart().toLowerCase().startsWith('insert'));
		expect(inserts).toHaveLength(0);
	});
});
