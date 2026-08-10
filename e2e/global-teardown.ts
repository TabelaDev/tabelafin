import { execSync } from 'node:child_process';

// Roda DEPOIS de todos os testes: apaga as transações manuais que eles criaram
// (fonte='manual'), pra não sobrar lixo no banco de dev. O global-setup já
// limpa antes por garantia (caso uma execução anterior tenha sido interrompida).
export default async function globalTeardown() {
	execSync(
		`bunx wrangler d1 execute tabelafin-db --local --command "DELETE FROM transactions WHERE source='manual'"`,
		{ stdio: 'inherit' }
	);
}
