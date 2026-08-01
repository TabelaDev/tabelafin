// Login via token compartilhado (não Google OAuth como o TabelaCal): o
// TabelaFin não precisa de nenhuma API do Google, e abrir o app pra múltiplos
// usuários está fora de escopo por enquanto (ver ESCOPO.md §4) — um secret
// único (LOGIN_TOKEN) autentica o dono da instância, que é sempre o mesmo
// usuário (OWNER_EMAIL). Se o app abrir pra outras pessoas no futuro, isso
// precisa virar um mecanismo de identidade de verdade.
//
// Compara hashes SHA-256 de tamanho fixo em vez das strings originais: evita
// vazar o tamanho do token por timing, e o XOR acumulado evita short-circuit
// no primeiro byte diferente.
async function sha256(input: string): Promise<Uint8Array> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return new Uint8Array(digest);
}

export async function timingSafeEqualStrings(a: string, b: string): Promise<boolean> {
	const [da, db] = await Promise.all([sha256(a), sha256(b)]);
	let diff = 0;
	for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
	return diff === 0;
}
