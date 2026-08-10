// Cliente fetch-based pra API interna do Meu Pluggy (my-api.pluggy.ai) —
// ver ESCOPO.md §2.3. Substitui o cliente anterior que usava api.pluggy.ai
// com Client ID/Secret do Pluggy Dashboard (que só funciona em sandbox).
//
// A API do Meu Pluggy usa JWT (Auth0) em vez de API key. O token é obtido
// quando o usuário faz login no Meu Pluggy e é armazenado cifrado em
// pluggy_credentials.token_encrypted. A API retorna arrays simples (sem
// paginação offset/cursor) — mais simples que a API comercial da Pluggy.
//
// Confirmado contra my-api.pluggy.ai em 2026-08-04 via MCP/DevTools.

const MY_API_URL = 'https://my-api.pluggy.ai';

interface MyApiError {
	message?: string;
	code?: number;
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
// Itens (conexões bancárias)
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
// Contas
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
// Transações
// ────────────────────────────────────────────────────────────────────────────

export interface PluggyTransaction {
	id: string;
	description: string;
	// Valor na moeda da conta (amountInAccountCurrency quando a transação é
	// estrangeira) — o que o dashboard soma. Pra Nubank/XP/Itaú é sempre BRL.
	amount: number;
	date: string; // ISO 8601
	// Moeda ORIGINAL da transação (ex.: "USD" pra compra no exterior). Usada
	// só pra exibição — a soma sempre usa `amount` (convertido).
	currency: string;
	category: string | null;
}

export async function fetchTransactions(
	token: string,
	accountIds: string[]
): Promise<PluggyTransaction[]> {
	const all: PluggyTransaction[] = [];
	// A API do Meu Pluggy aceita múltiplos accountIds via query params repetidos,
	// mas pra simplificar e evitar URLs longas, buscamos uma conta por vez.
	for (const accountId of accountIds) {
		const res = await myApiFetch(`/transactions?accountId=${accountId}`, token);
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
				// Compra internacional: a API dá o valor convertido pra moeda da
				// conta (ex.: USD 5,30 → R$ 28,06). Usa esse valor pra somar
				// certo — senão uma compra em dólar seria contada como reais.
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
// Investimentos
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
