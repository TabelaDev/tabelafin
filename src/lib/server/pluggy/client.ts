// Cliente fetch-based pra API da Pluggy (Open Finance) — ver ESCOPO.md §2.3.
// Sem SDK npm nesse lado (pluggy-js/pluggy-sdk não são um alvo garantido pro
// runtime `workerd`) — só fetch() puro, mesmo padrão do cliente OAuth do
// TabelaCal (src/lib/server/google/oauth.ts). O widget Pluggy Connect
// client-side é outra história (ver $lib/PluggyConnect.svelte): esse sim
// carrega um script de terceiro, mas nunca roda no Worker.
//
// Confirmado contra docs.pluggy.ai em 2026-08-01 (via WebFetch/WebSearch +
// leitura direta de github.com/pluggyai/quickstart e do d.ts publicado do
// pluggy-connect-sdk). Onde a doc pública não fechou 100%, ver comentários
// `TODO(pluggy-verify)` pontuais abaixo — a pessoa fazendo o teste real com
// uma conta Meu Pluggy de verdade deve conferir esses pontos primeiro.

const PLUGGY_API_URL = 'https://api.pluggy.ai';

interface PluggyErrorBody {
	message?: string;
	code?: number;
	codeDescription?: string;
}

async function pluggyFetch(path: string, init: RequestInit = {}): Promise<Response> {
	const res = await fetch(`${PLUGGY_API_URL}${path}`, init);
	if (!res.ok) {
		// Formato de erro confirmado (docs.pluggy.ai/reference/auth-create):
		// { code, message, codeDescription?, data? } — mesmo shape usado nos
		// outros endpoints da API.
		const body = (await res.json().catch(() => null)) as PluggyErrorBody | null;
		throw new Error(`Pluggy API error (${path}): ${res.status} ${body?.message ?? res.statusText}`);
	}
	return res;
}

// POST /auth — troca o Client ID/Secret DO PRÓPRIO usuário (Meu Pluggy, não
// nossa conta) por um apiKey de uso backend, válido por ~2h. Confirmado:
// docs.pluggy.ai/docs/authentication + docs.pluggy.ai/reference/auth-create.
export async function getApiKey(clientId: string, clientSecret: string): Promise<string> {
	const res = await pluggyFetch('/auth', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ clientId, clientSecret })
	});
	const data = (await res.json()) as { apiKey: string };
	return data.apiKey;
}

// POST /connect_token — token de curta duração (30min, confirmado:
// docs.pluggy.ai/reference/connect-token-create) pra entregar ao widget
// client-side; o apiKey de backend nunca deve chegar no browser. `itemId`
// opcional reautentica/atualiza um item já existente (fluxo de reconexão,
// ex.: credenciais bancárias expiradas) em vez de criar um item novo.
export async function createConnectToken(
	apiKey: string,
	options?: { itemId?: string }
): Promise<string> {
	const res = await pluggyFetch('/connect_token', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'X-API-KEY': apiKey },
		body: JSON.stringify(options?.itemId ? { itemId: options.itemId } : {})
	});
	const data = (await res.json()) as { accessToken: string };
	return data.accessToken;
}

export interface PluggyItem {
	id: string;
	institutionName: string;
	institutionType: string;
	status: string;
}

// GET /items/{id} — status da conexão + dados da instituição. Confirmado:
// docs.pluggy.ai/reference/items-retrieve, docs.pluggy.ai/docs/item.
//
// TODO(pluggy-verify): a doc pública (schema OpenAPI de items-retrieve) tipa
// `status` como string genérica, sem enum fechado — só UPDATED/UPDATING/
// LOGIN_ERROR apareceram confirmados em texto. OUTDATED e WAITING_USER_INPUT
// (usados no comentário de schema.ts:pluggyItems.status) são suposição
// histórica, não confirmada nesta pesquisa. Conferir a lista completa de
// valores possíveis com uma conta Meu Pluggy real antes de depender desses
// dois especificamente (ex.: pra decidir quando pedir o usuário reconectar).
export async function fetchItem(apiKey: string, itemId: string): Promise<PluggyItem> {
	const res = await pluggyFetch(`/items/${itemId}`, {
		headers: { 'X-API-KEY': apiKey }
	});
	const data = (await res.json()) as {
		id: string;
		status: string;
		connector: { name: string; type: string };
	};
	return {
		id: data.id,
		institutionName: data.connector.name,
		institutionType: data.connector.type,
		// schema.ts guarda o status em minúsculo (ver comentário na tabela
		// pluggyItems) — a API devolve maiúsculo (ex.: "UPDATED").
		status: data.status.toLowerCase()
	};
}

export interface PluggyAccount {
	id: string;
	type: 'checking' | 'credit_card';
	name: string;
	currency: string;
	balance: number;
}

// GET /accounts?itemId={id} — contas bancárias/cartão do item, paginado
// (page/total/totalPages/results). Confirmado: docs.pluggy.ai/reference/accounts-list
// — o campo `type` só aparece com os valores BANK/CREDIT (não existe um
// INVESTMENT aqui): investimentos são um produto à parte na Pluggy, ver
// fetchInvestments abaixo e ESCOPO.md §2.3 ("produto de Investments dedicado").
export async function fetchAccounts(apiKey: string, itemId: string): Promise<PluggyAccount[]> {
	const results = await fetchAllPages<{
		id: string;
		type: string;
		name: string;
		currencyCode: string;
		balance: number;
	}>(apiKey, `/accounts?itemId=${itemId}`);
	return results.map((a) => ({
		id: a.id,
		type: a.type === 'CREDIT' ? 'credit_card' : 'checking',
		name: a.name,
		currency: a.currencyCode,
		balance: a.balance
	}));
}

export interface PluggyTransaction {
	id: string;
	description: string;
	amount: number;
	date: string; // ISO 8601
	currency: string;
}

// GET /transactions?accountId={id}&from=&to= — paginação offset-based
// (page/total/totalPages/results). Ignoramos de propósito o campo `category`
// que a Pluggy retorna: o TabelaFin categoriza via IA em lote, nunca usa a
// categorização própria da Pluggy (ESCOPO.md §2.2/§3.3).
//
// TODO(pluggy-verify): esse endpoint (GET /transactions) está marcado como
// DEPRECATED na doc pública, com remoção prevista depois de 2026-12-31, a
// favor de GET /v2/transactions (paginação por cursor, não por página). A
// pesquisa não conseguiu confirmar com certeza o formato exato do cursor de
// saída da v2 (nome do campo, se é só o valor do cursor ou uma query string
// inteira) — por isso este cliente ficou no endpoint legado (ainda válido e
// com a paginação que já foi possível confirmar). Migrar pra v2 antes de
// 2026-12-31, conferindo esse detalhe com uma conta real.
export async function fetchTransactions(
	apiKey: string,
	accountId: string,
	opts?: { from?: string; to?: string }
): Promise<PluggyTransaction[]> {
	const params = new URLSearchParams({ accountId });
	if (opts?.from) params.set('from', opts.from);
	if (opts?.to) params.set('to', opts.to);
	const results = await fetchAllPages<{
		id: string;
		description: string;
		amount: number;
		date: string;
		currencyCode: string;
	}>(apiKey, `/transactions?${params}`);
	return results.map((t) => ({
		id: t.id,
		description: t.description,
		amount: t.amount,
		date: t.date,
		currency: t.currencyCode
	}));
}

export interface PluggyInvestment {
	id: string;
	name: string;
	balance: number;
	currency: string;
}

// GET /investments?itemId={id} — produto dedicado de investimentos (cobre
// XP/XP Wealth, ver ESCOPO.md §2.3), paginado do mesmo jeito que /accounts.
// Confirmado que é necessário (não dá pra ignorar): docs.pluggy.ai/reference/accounts-list
// não lista INVESTMENT como valor de `type`, então contas de investimento
// NÃO aparecem em /accounts — só aqui. Confirmado:
// docs.pluggy.ai/reference/investments-list, docs.pluggy.ai/docs/investments.
// Cada investimento vira uma "conta" (accounts.type='investment') no sync —
// ver src/lib/server/pluggy/sync.ts — sem transações associadas: o produto
// de movimentações de investimento (investmentsTransactions) é separado e
// está fora de escopo do MVP (ESCOPO.md só pede "saldo de investimentos").
export async function fetchInvestments(
	apiKey: string,
	itemId: string
): Promise<PluggyInvestment[]> {
	const results = await fetchAllPages<{
		id: string;
		name: string;
		balance: number;
		value: number;
		currencyCode?: string;
	}>(apiKey, `/investments?itemId=${itemId}`);
	return results.map((i) => ({
		id: i.id,
		name: i.name,
		balance: i.balance ?? i.value,
		currency: i.currencyCode ?? 'BRL'
	}));
}

interface PaginatedResponse<T> {
	page: number;
	totalPages: number;
	results: T[];
}

async function fetchAllPages<T>(apiKey: string, pathWithQuery: string): Promise<T[]> {
	const separator = pathWithQuery.includes('?') ? '&' : '?';
	const all: T[] = [];
	let page = 1;
	for (;;) {
		const res = await pluggyFetch(`${pathWithQuery}${separator}page=${page}`, {
			headers: { 'X-API-KEY': apiKey }
		});
		const data = (await res.json()) as PaginatedResponse<T>;
		all.push(...data.results);
		if (page >= data.totalPages) break;
		page++;
	}
	return all;
}
