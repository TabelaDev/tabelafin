// fetch-based client for the internal Meu Pluggy API (my-api.pluggy.ai) — see
// ESCOPO.md §2.3. It replaces the earlier client that used api.pluggy.ai with a
// Client ID/Secret from the Pluggy Dashboard (which only works in sandbox).
//
// The Meu Pluggy API uses a JWT (Auth0) rather than an API key. The token is
// obtained when the user logs in to Meu Pluggy and is stored encrypted in
// pluggy_credentials.token_encrypted. The API returns plain arrays (no
// offset/cursor pagination) — simpler than Pluggy's commercial API.
//
// Confirmed against my-api.pluggy.ai on 2026-08-04 through MCP/DevTools.

const MY_API_URL = 'https://my-api.pluggy.ai';

interface MyApiError {
	message?: string;
	code?: number;
}

/**
 * Returns the `exp` of a JWT as epoch milliseconds, or null when the token
 * cannot be parsed. The Meu Pluggy token is an Auth0 JWT that expires in ~24h;
 * the expiry is stored when the token is received so the UI can say "expirado".
 */
export function jwtExpiresAt(jwt: string): number | null {
	const payload = jwt.split('.')[1];
	if (!payload) return null;
	try {
		const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
		const { exp } = JSON.parse(json) as { exp?: number };
		return typeof exp === 'number' ? exp * 1000 : null;
	} catch {
		return null;
	}
}

async function myApiFetch(path: string, token: string): Promise<Response> {
	const res = await fetch(`${MY_API_URL}${path}`, {
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/json'
		}
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as MyApiError | null;
		throw new Error(
			`My Pluggy API error (${path}): ${res.status} ${body?.message ?? res.statusText}`
		);
	}
	return res;
}

// ────────────────────────────────────────────────────────────────────────────
// Items (bank connections)
// ────────────────────────────────────────────────────────────────────────────

export interface PluggyItem {
	id: string;
	institutionName: string;
	institutionType: string;
	status: string;
}

export async function fetchItems(token: string): Promise<PluggyItem[]> {
	const res = await myApiFetch('/items?only_my_items=true', token);
	const data = (await res.json()) as Array<{
		id: string;
		connector: { name: string; type: string };
		status: string;
	}>;
	return data.map((item) => ({
		id: item.id,
		institutionName: item.connector.name,
		institutionType: item.connector.type,
		status: item.status.toLowerCase()
	}));
}

// ────────────────────────────────────────────────────────────────────────────
// Accounts
// ────────────────────────────────────────────────────────────────────────────

export interface PluggyAccount {
	id: string;
	type: 'checking' | 'credit_card';
	name: string;
	currency: string;
	balance: number;
}

export async function fetchAccounts(token: string, itemIds: string[]): Promise<PluggyAccount[]> {
	const params = itemIds.map((id) => `itemId=${id}`).join('&');
	const res = await myApiFetch(`/accounts?${params}`, token);
	const data = (await res.json()) as Array<{
		id: string;
		type: string;
		subtype?: string;
		name: string;
		currencyCode: string;
		balance: number;
	}>;
	return data.map((a) => ({
		id: a.id,
		type: a.subtype === 'CREDIT_CARD' || a.type === 'CREDIT' ? 'credit_card' : 'checking',
		name: a.name,
		currency: a.currencyCode,
		balance: a.balance
	}));
}

// ────────────────────────────────────────────────────────────────────────────
// Transactions
// ────────────────────────────────────────────────────────────────────────────

export interface PluggyTransaction {
	id: string;
	description: string;
	// The amount in the account's currency (amountInAccountCurrency when the
	// transaction is foreign) — this is what the dashboard sums. For
	// Nubank/XP/Itaú it is always BRL.
	amount: number;
	date: string; // ISO 8601
	// The transaction's ORIGINAL currency (e.g. "USD" for a purchase abroad). Used
	// for display only — the sums always use `amount`, which is converted.
	currency: string;
	category: string | null;
}

/**
 * Fetches transactions for the given accounts.
 *
 * `from` bounds the window. Without it every sync pulled the account's entire
 * history and then re-checked each row against the database — work that grows
 * forever — so the caller passes the item's last sync date with a few days of
 * slack for retroactive postings.
 */
export async function fetchTransactions(
	token: string,
	accountIds: string[],
	from?: Date
): Promise<PluggyTransaction[]> {
	const all: PluggyTransaction[] = [];
	// The Meu Pluggy API accepts several accountIds through repeated query params,
	// but to keep things simple and the URLs short we fetch one account at a time.
	for (const accountId of accountIds) {
		const params = new URLSearchParams({ accountId });
		if (from) params.set('from', from.toISOString().slice(0, 10));
		const res = await myApiFetch(`/transactions?${params}`, token);
		const data = (await res.json()) as Array<{
			id: string;
			description: string;
			amount: number;
			date: string;
			currencyCode: string;
			category?: string | null;
			amountInAccountCurrency?: number | null;
		}>;
		for (const t of data) {
			all.push({
				id: t.id,
				description: t.description,
				// International purchase: the API gives the amount converted into the
				// account's currency (USD 5.30 → R$ 28.06). Using that value is what
				// makes the sums right — otherwise a purchase in dollars would be
				// counted as reais.
				amount: t.amountInAccountCurrency ?? t.amount,
				date: t.date,
				currency: t.currencyCode,
				category: t.category ?? null
			});
		}
	}
	return all;
}

// ────────────────────────────────────────────────────────────────────────────
// Investments
// ────────────────────────────────────────────────────────────────────────────

export interface PluggyInvestment {
	id: string;
	name: string;
	balance: number;
	currency: string;
}

export async function fetchInvestments(
	token: string,
	itemIds: string[]
): Promise<PluggyInvestment[]> {
	const all: PluggyInvestment[] = [];
	for (const itemId of itemIds) {
		const res = await myApiFetch(`/investments?itemId=${itemId}`, token);
		const data = (await res.json()) as Array<{
			id: string;
			name: string;
			balance: number;
			value?: number;
			currencyCode?: string;
		}>;
		for (const i of data) {
			all.push({
				id: i.id,
				name: i.name,
				balance: i.balance ?? i.value ?? 0,
				currency: i.currencyCode ?? 'BRL'
			});
		}
	}
	return all;
}
