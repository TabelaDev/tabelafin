import { describe, expect, it } from 'vitest';

import { SYNC_COOLDOWN_MS, shouldRecoverySync, shouldRefreshSync } from './pluggy-items';

const NOW = new Date('2026-08-16T12:00:00Z');

function item(overrides: Partial<{ lastSyncedAt: Date | null; lastSyncAttemptAt: Date | null }>) {
	return { lastSyncedAt: null, lastSyncAttemptAt: null, ...overrides };
}

function minutesAgo(minutes: number): Date {
	return new Date(NOW.getTime() - minutes * 60 * 1000);
}

describe('shouldRecoverySync', () => {
	it('syncs an item that has never been touched', () => {
		expect(shouldRecoverySync([item({})], NOW)).toBe(true);
	});

	it('leaves an item that already synced successfully alone', () => {
		expect(shouldRecoverySync([item({ lastSyncedAt: minutesAgo(600) })], NOW)).toBe(false);
	});

	// The regression this file exists for: before `lastSyncAttemptAt`, an item
	// whose sync kept failing never got `lastSyncedAt`, so the condition stayed
	// true and every single navigation fired a full sync — including the batched
	// AI call, billed to the user's own key.
	it('does not re-fire for an item that failed moments ago', () => {
		expect(shouldRecoverySync([item({ lastSyncAttemptAt: minutesAgo(1) })], NOW)).toBe(false);
	});

	it('retries once the cooldown has elapsed', () => {
		expect(shouldRecoverySync([item({ lastSyncAttemptAt: minutesAgo(16) })], NOW)).toBe(true);
	});

	it('treats the cooldown boundary as elapsed', () => {
		const attempt = new Date(NOW.getTime() - SYNC_COOLDOWN_MS);
		expect(shouldRecoverySync([item({ lastSyncAttemptAt: attempt })], NOW)).toBe(true);
	});

	it('syncs when any one item still needs it', () => {
		const items = [
			item({ lastSyncedAt: minutesAgo(30) }),
			item({ lastSyncAttemptAt: minutesAgo(1) }),
			item({})
		];
		expect(shouldRecoverySync(items, NOW)).toBe(true);
	});

	it('is false with no items', () => {
		expect(shouldRecoverySync([], NOW)).toBe(false);
	});
});

describe('shouldRefreshSync', () => {
	// Unlike the recovery case this fires for healthy items too — a fresh token
	// is a good moment to pull new data — so only the cooldown holds it back.
	it('syncs a healthy item whose last attempt is outside the cooldown', () => {
		const items = [item({ lastSyncedAt: minutesAgo(20), lastSyncAttemptAt: minutesAgo(20) })];
		expect(shouldRefreshSync(items, NOW)).toBe(true);
	});

	it('throttles a healthy item synced moments ago', () => {
		const items = [item({ lastSyncedAt: minutesAgo(2), lastSyncAttemptAt: minutesAgo(2) })];
		expect(shouldRefreshSync(items, NOW)).toBe(false);
	});

	it('syncs an item that was never attempted', () => {
		expect(shouldRefreshSync([item({})], NOW)).toBe(true);
	});

	it('is false with no items — nothing connected to sync', () => {
		expect(shouldRefreshSync([], NOW)).toBe(false);
	});
});
