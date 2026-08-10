import { execSync } from 'node:child_process';

// Limpa as transações manuais criadas por execuções anteriores dos testes E2E
// (fonte='manual' é só o que os testes gravam — nunca toca dados vindos do
// Open Finance/PDF). Os testes rodam no D1 local de dev; um D1 isolado só
// valeria a pena depois de resolver a divergência de layout de persistência
// entre o adapter-cloudflare e o wrangler CLI.
export default async function globalSetup() {
	execSync(
		`bunx wrangler d1 execute tabelafin-db --local --command "DELETE FROM transactions WHERE source='manual'"`,
		{ stdio: 'inherit' }
	);
}
