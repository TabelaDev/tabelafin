import { describe, expect, it } from 'vitest';

import { type SecretContext, decryptSecret, encryptSecret } from './crypto';

const ai: SecretContext = { purpose: 'ai_credentials', userId: 'user-1' };
const pluggy: SecretContext = { purpose: 'pluggy_credentials', userId: 'user-1' };
const otherUser: SecretContext = { purpose: 'ai_credentials', userId: 'user-2' };

describe('encryptSecret/decryptSecret', () => {
	it('round-trips a plaintext through the same master key and context', async () => {
		const payload = await encryptSecret('master-key-de-teste', 'segredo-do-usuario', ai);
		expect(await decryptSecret('master-key-de-teste', payload, ai)).toBe('segredo-do-usuario');
	});

	it('produces a different nonce (and ciphertext) on every call, even for the same plaintext', async () => {
		const a = await encryptSecret('master-key-de-teste', 'mesmo-segredo', ai);
		const b = await encryptSecret('master-key-de-teste', 'mesmo-segredo', ai);
		expect(a.nonce).not.toBe(b.nonce);
		expect(a.ciphertext).not.toBe(b.ciphertext);
	});

	it('fails to decrypt with a different master key', async () => {
		const payload = await encryptSecret('master-key-a', 'segredo', ai);
		await expect(decryptSecret('master-key-b', payload, ai)).rejects.toThrow();
	});

	it('accepts a master key of any length', async () => {
		const payload = await encryptSecret('curta', 'segredo', ai);
		expect(await decryptSecret('curta', payload, ai)).toBe('segredo');
	});

	// The point of binding the context: a row lifted from one table into the
	// other, or from one user to another, must not open.
	it('refuses a payload presented under a different purpose', async () => {
		const payload = await encryptSecret('master-key-de-teste', 'token-pluggy', pluggy);
		await expect(decryptSecret('master-key-de-teste', payload, ai)).rejects.toThrow();
	});

	it("refuses another user's payload", async () => {
		const payload = await encryptSecret('master-key-de-teste', 'chave', ai);
		await expect(decryptSecret('master-key-de-teste', payload, otherUser)).rejects.toThrow();
	});

	it('stamps the scheme version so it can be rotated later', async () => {
		const payload = await encryptSecret('master-key-de-teste', 'segredo', ai);
		expect(payload.v).toBe(2);
	});

	it('rejects a payload written by an unknown future scheme', async () => {
		const payload = await encryptSecret('master-key-de-teste', 'segredo', ai);
		await expect(decryptSecret('master-key-de-teste', { ...payload, v: 99 }, ai)).rejects.toThrow(
			/versão desconhecida/
		);
	});
});
