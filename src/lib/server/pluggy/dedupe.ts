// Fingerprint de dedupe (ESCOPO.md §5) — hash estável de (conta, valor, dia)
// usado como candidato rápido de "essa transação já existe" (ex.: reprocessar
// o mesmo sync duas vezes). A regra de dedupe cross-source de verdade
// (transação Pluggy substituindo uma de PDF, tolerância de ±3 dias) NÃO pode
// depender só da igualdade deste hash — duas datas a poucos dias de distância
// dão hashes diferentes de propósito, já que o dia entra exato na string.
// Essa comparação por range de data fica em findSupersedeCandidate
// (src/lib/server/db/transactions.ts), que faz uma query por
// conta+valor+intervalo de data em vez de comparar hashes.
//
// Função pura e síncrona (sem WebCrypto) — só precisa ser um fingerprint
// determinístico, não um hash criptográfico.
export function computeDedupeHash(accountId: string, amount: number, date: Date): string {
	const day = date.toISOString().slice(0, 10); // YYYY-MM-DD, ignora hora
	const input = `${accountId}:${amount.toFixed(2)}:${day}`;

	// FNV-1a de 32 bits.
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}
