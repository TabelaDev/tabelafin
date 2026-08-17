// Shared wrapper for outbound calls to third-party APIs (the AI providers and
// Meu Pluggy). It adds the two things `fetch` does not give us for free in
// `workerd`:
//
// - **A timeout.** There is no default one, so a provider that accepts the
//   connection and then stalls pins the Worker until the platform kills the
//   whole invocation — taking down the rest of the sync with it.
// - **One retry on a transient status.** The AI keys are the user's own and
//   usually on the lowest rate tier, where a single burst returns 429. Without
//   a retry, a rate-limited batch is simply lost until the next sync.
//
// Deliberately not a general-purpose client: no circuit breaker, no jitter, no
// per-host budget. It exists to stop two specific failure modes.

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_RETRIES = 1;

// 408/425 are included because a timed-out or too-early request is safe to send
// again; 5xx and 429 are the usual transient provider failures. Everything else
// (401, 400, 403, 404, 422…) is a request the retry would repeat verbatim, so
// retrying only wastes the user's quota.
const RETRIABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

// Ceiling for a provider-supplied Retry-After. Some send minutes, and a Worker
// invocation cannot afford to sit there.
const MAX_RETRY_DELAY_MS = 10_000;

export interface FetchWithRetryOptions {
	// The signal spans the *whole* exchange, response body included — aborting it
	// errors an in-flight stream. A streaming caller therefore needs a budget for
	// the full answer, not just for the headers (see api/chat).
	timeoutMs?: number;
	// Number of *extra* attempts after the first one. Safe for streaming too: a
	// retry only happens on a retriable status, which is decided before the body
	// is touched.
	retries?: number;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(res: Response | null, attempt: number): number {
	const header = res?.headers?.get('retry-after');
	if (header) {
		// Either a delay in seconds or an HTTP date — only the seconds form is
		// worth honouring here.
		const seconds = Number(header);
		if (Number.isFinite(seconds) && seconds > 0) {
			return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
		}
	}
	return Math.min(500 * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

export async function fetchWithRetry(
	url: string,
	init: RequestInit = {},
	options: FetchWithRetryOptions = {}
): Promise<Response> {
	const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = options;

	let lastError: unknown;

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

			// Out of attempts, or a status the caller has to deal with itself:
			// hand the response over so the error message keeps the provider's body.
			if (attempt === retries || !RETRIABLE_STATUSES.has(res.status)) return res;

			await sleep(retryDelayMs(res, attempt));
		} catch (err) {
			// Network failure or the timeout above firing. Keep the first error:
			// it is the one that describes what actually went wrong.
			lastError ??= err;
			if (attempt === retries) break;
			await sleep(retryDelayMs(null, attempt));
		}
	}

	throw lastError;
}
