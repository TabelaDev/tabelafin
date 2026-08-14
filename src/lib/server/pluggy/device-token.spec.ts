import { describe, expect, it } from 'vitest';
import { DEVICE_TOKEN_KV_PREFIX, generateDeviceToken } from './device-token';

describe('generateDeviceToken', () => {
	it('produces 32 bytes in base64url without padding characters', () => {
		const token = generateDeviceToken();
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(token).not.toMatch(/[+/=]/);
		// 32 bytes in base64 = 44 chars; base64url without padding keeps the same.
		expect(token.length).toBe(43);
	});

	it('generates distinct tokens on each call', () => {
		const a = generateDeviceToken();
		const b = generateDeviceToken();
		expect(a).not.toBe(b);
	});
});

describe('DEVICE_TOKEN_KV_PREFIX', () => {
	it('is the prefix used in session KV keys', () => {
		expect(DEVICE_TOKEN_KV_PREFIX).toBe('pluggy_device:');
	});
});
