// Fixed-window rate limiting backed by the SESSIONS KV namespace.
//
// Why this exists at all: Better Auth ships a rate limiter, but it only runs
// inside `auth.handler` — the router middleware. The login and signup pages
// call `auth.api.signInEmail` / `signUpEmail` directly from a form action,
// which bypasses the router entirely, so password guessing against POST /login
// was unlimited. Its default store is also in-memory, which in Workers means
// per-isolate: effectively no limit at all.
//
// Why KV rather than D1: this is written on every login attempt including the
// failures, it never needs a transaction, and entries are meant to expire on
// their own. KV's `expirationTtl` does that server-side; a D1 table would need
// a cleanup job. The trade-off is KV's eventual consistency — two simultaneous
// attempts against different edge locations can both read a stale count, so a
// determined attacker gets a few extra tries per window. That is an acceptable
// bound for password guessing; it would not be for anything that must be exact.

export interface RateLimitRule {
	// Attempts allowed inside one window.
	limit: number;
	// Window length in seconds.
	windowSeconds: number;
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	// Seconds until the window resets — surfaced to the user so the message can
	// say how long to wait instead of just "try again later".
	retryAfterSeconds: number;
}

// Sign-in: tight enough to make online guessing useless, loose enough to
// survive a person fat-fingering their password a few times.
export const SIGN_IN_RULE: RateLimitRule = { limit: 8, windowSeconds: 15 * 60 };

// Sign-up: the cost here is account spam, and each account is then iterated by
// both crons — so this is deliberately stricter than sign-in.
export const SIGN_UP_RULE: RateLimitRule = { limit: 4, windowSeconds: 60 * 60 };

interface Bucket {
	count: number;
	// Epoch ms when the current window started.
	startedAt: number;
}

// `key` identifies who is being limited — see clientRateLimitKey below.
export async function checkRateLimit(
	kv: KVNamespace,
	scope: string,
	key: string,
	rule: RateLimitRule,
	now = Date.now()
): Promise<RateLimitResult> {
	const storageKey = `ratelimit:${scope}:${key}`;
	const windowMs = rule.windowSeconds * 1000;

	const existing = await kv.get<Bucket>(storageKey, 'json');
	const bucket: Bucket =
		existing && now - existing.startedAt < windowMs ? existing : { count: 0, startedAt: now };

	const elapsed = now - bucket.startedAt;
	const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));

	if (bucket.count >= rule.limit) {
		return { allowed: false, remaining: 0, retryAfterSeconds };
	}

	bucket.count += 1;
	// TTL covers the remainder of the window, so the entry disappears on its own
	// rather than accumulating one key per address forever. KV's floor is 60s.
	await kv.put(storageKey, JSON.stringify(bucket), {
		expirationTtl: Math.max(60, retryAfterSeconds)
	});

	return { allowed: true, remaining: rule.limit - bucket.count, retryAfterSeconds };
}

// Identity for the bucket. `CF-Connecting-IP` is set by Cloudflare on every
// inbound request and cannot be spoofed by the client — unlike X-Forwarded-For,
// which anyone can send. When it is missing (local dev), everything shares one
// bucket, which is the safe direction to fail.
export function clientRateLimitKey(request: Request, suffix?: string): string {
	const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	return suffix ? `${ip}:${suffix.toLowerCase()}` : ip;
}

export function rateLimitMessage(retryAfterSeconds: number): string {
	const minutes = Math.ceil(retryAfterSeconds / 60);
	return minutes <= 1
		? 'Muitas tentativas. Tente novamente em cerca de 1 minuto.'
		: `Muitas tentativas. Tente novamente em cerca de ${minutes} minutos.`;
}
