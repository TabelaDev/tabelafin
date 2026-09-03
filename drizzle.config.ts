import { defineConfig } from 'drizzle-kit';

// D1 workflow: `drizzle-kit generate` only emits the SQL to ./drizzle;
// the wrangler applies it (`wrangler d1 migrations apply tabelhafin-db --local|--remote`).
// That's why there's no `driver` or credentials here.
export default defineConfig({
	out: './drizzle',
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	verbose: true,
	strict: true
});
