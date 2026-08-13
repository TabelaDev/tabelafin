import { describe, expect, it } from 'vitest';
import { DEVICE_TOKEN_KV_PREFIX, generateDeviceToken } from './device-token';

describe('generateDeviceToken', () => {
	it('produz 32 bytes em base64url, sem caracteres de padding', () => {
		const token = generateDeviceToken();
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(token).not.toMatch(/[+/=]/);
		// 32 bytes em base64 = 44 chars; base64url sem padding mantém o mesmo.
		expect(token.length).toBe(43);
	});

	it('gera tokens distintos a cada chamada', () => {
		const a = generateDeviceToken();
		const b = generateDeviceToken();
		expect(a).not.toBe(b);
	});
});

describe('DEVICE_TOKEN_KV_PREFIX', () => {
	it('é o prefixo usado nas chaves do KV de sessões', () => {
		expect(DEVICE_TOKEN_KV_PREFIX).toBe('pluggy_device:');
	});
});
