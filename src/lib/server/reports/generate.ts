// Cron mensal (dia 1, ESCOPO.md §3.6): gera monthly_reports do mês anterior
// pra cada usuário e dispara push avisando que o relatório está pronto.
//
// TODO: ainda não implementado — depende do modelo de categorização (ver
// src/lib/server/pluggy/sync.ts) já ter rodado pro mês em questão.
export async function generateMonthlyReports(env: Env): Promise<void> {
	console.log('[reports/generate] generateMonthlyReports: not yet implemented', {
		hasDb: Boolean(env.DB)
	});
}
