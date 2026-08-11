// Encryption for ai_credentials and pluggy_credentials (ESCOPO.md §5).
//
// AES-GCM with a random 96-bit nonce per write. What changed since the first
// version, and why:
//
//   * The key came from a bare SHA-256 of MASTER_KEY. A single hash is not a
//     KDF — if the master key is ever a passphrase rather than 32 random bytes,
//     offline brute force is cheap. HKDF costs nothing here and closes that.
//
//   * Nothing bound a ciphertext to what it was for, so a row copied from
//     ai_credentials into pluggy_credentials (or between users) decrypted
//     happily. The context string is fed to HKDF *and* passed as AES-GCM
//     additional data, so a payload only opens under the same purpose.
//
//   * The payload carried no version, so rotating the scheme would have meant
//     every stored secret becoming unreadable with no way to tell why. `v` is
//     stored now and decrypt dispatches on it.

/** Current scheme: HKDF-SHA-256 → AES-256-GCM, context-bound. */
const CURRENT_VERSION = 2;

/** v1: SHA-256(masterKey) → AES-256-GCM, no context binding. Read-only. */
const LEGACY_VERSION = 1;

export interface EncryptedPayload {
	ciphertext: string;
	nonce: string;
	/** Absent means v1, written before the field existed. */
	v?: number;
}

/**
 * Identifies what a ciphertext is for. Two secrets belonging to different users
 * or different providers never share a key, so one cannot be substituted for
 * the other.
 */
export interface SecretContext {
	/** e.g. "ai_credentials" or "pluggy_credentials". */
	purpose: string;
	userId: string;
}

const encoder = new TextEncoder();

// Returns a view backed by a plain ArrayBuffer: WebCrypto's BufferSource does
// not accept the ArrayBufferLike-backed view TextEncoder hands back.
function toBytes(text: string): Uint8Array<ArrayBuffer> {
	const encoded = encoder.encode(text);
	const view = new Uint8Array(new ArrayBuffer(encoded.byteLength));
	view.set(encoded);
	return view;
}

function contextBytes(context: SecretContext): Uint8Array<ArrayBuffer> {
	return toBytes(`tabelafin:v${CURRENT_VERSION}:${context.purpose}:${context.userId}`);
}

async function deriveKeyV2(masterKey: string, context: SecretContext): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey('raw', toBytes(masterKey), 'HKDF', false, [
		'deriveKey'
	]);
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			// The master key is the only secret input; the salt is fixed so the
			// same context always derives the same key.
			salt: toBytes('tabelafin/credentials'),
			info: contextBytes(context)
		},
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

async function deriveKeyV1(masterKey: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest('SHA-256', toBytes(masterKey));
	return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export async function encryptSecret(
	masterKey: string,
	plaintext: string,
	context: SecretContext
): Promise<EncryptedPayload> {
	const key = await deriveKeyV2(masterKey, context);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: contextBytes(context) },
		key,
		toBytes(plaintext)
	);
	return {
		ciphertext: toBase64(new Uint8Array(ciphertext)),
		nonce: toBase64(iv),
		v: CURRENT_VERSION
	};
}

export async function decryptSecret(
	masterKey: string,
	payload: EncryptedPayload,
	context: SecretContext
): Promise<string> {
	const version = payload.v ?? LEGACY_VERSION;
	const iv = fromBase64(payload.nonce);
	const data = fromBase64(payload.ciphertext);

	if (version === LEGACY_VERSION) {
		// Written before contexts existed: no additional data to verify against.
		const key = await deriveKeyV1(masterKey);
		const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
		return new TextDecoder().decode(plaintext);
	}

	if (version !== CURRENT_VERSION) {
		throw new Error(`payload cifrado com versão desconhecida (${version})`);
	}

	const key = await deriveKeyV2(masterKey, context);
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv, additionalData: contextBytes(context) },
		key,
		data
	);
	return new TextDecoder().decode(plaintext);
}
