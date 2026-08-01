// Sync diário via cron (ESCOPO.md §3.2): puxa accounts/transactions/investments
// da Pluggy pra cada pluggy_item de cada usuário, roda dedupe (§5) e dispara a
// categorização em lote sobre as transações novas.
//
// TODO: ainda não implementado — depende do cliente Pluggy
// (src/lib/server/pluggy/client.ts, a criar) e do fluxo de categorização em
// lote (src/lib/server/ai/categorize.ts, a criar).
export async function syncAllUsers(env: Env): Promise<void> {
	console.log('[pluggy/sync] syncAllUsers: not yet implemented', { hasDb: Boolean(env.DB) });
}
