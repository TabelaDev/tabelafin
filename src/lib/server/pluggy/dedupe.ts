// Dedupe fingerprint (ESCOPO.md §5) — a stable hash of (account, amount, day)
// used as a cheap "this transaction already exists" candidate (e.g. reprocessing
// the same sync twice). The real cross-source dedupe rule (a Pluggy transaction
// superseding a PDF one, with ±3 days of tolerance) can NOT rely on equality of
// this hash alone — two dates a few days apart hash differently by design, since
// the exact day goes into the string. That date-range comparison lives in
// findSupersedeCandidate (src/lib/server/db/transactions.ts), which queries by
// account + amount + date range instead of comparing hashes.
//
// Pure and synchronous (no WebCrypto) — it only has to be a deterministic
// fingerprint, not a cryptographic hash.
export function computeDedupeHash(accountId: string, amount: number, date: Date): string {
	const day = date.toISOString().slice(0, 10); // YYYY-MM-DD, time ignored
	const input = `${accountId}:${amount.toFixed(2)}:${day}`;

	// FNV-1a de 32 bits.
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}
