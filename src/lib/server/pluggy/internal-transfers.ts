// Categorias da API do Meu Pluggy que representam transferência interna de
// dinheiro do próprio usuário — movimentação que NÃO é gasto nem receita:
// aplicar/resgatar investimento, pagar a fatura do cartão (o gasto já entrou
// pela compra no cartão), transferir entre contas do mesmo dono.
//
// Vêm de `transactions.pluggy_category` (campo `category` bruto da API).
// Confirmado contra my-api.pluggy.ai em 2026-08-09 (conta Nubank + XP real).
//
// Atenção: `Transfers` genérico NÃO está aqui de propósito — no Nubank ele
// engloba compras parceladas de verdade ("Dio 12/12", "Plano NuCel"), que são
// gasto real e devem continuar no dashboard.
export const INTERNAL_TRANSFER_CATEGORIES = new Set([
	'Investments', // aplicação/resgate em investimento
	'Fixed income', // aplicação em CDB/renda fixa
	'Third party transfers', // resgate de investimento ("Valor recebido de Investimentos")
	'Same person transfer', // transferência entre contas do mesmo dono
	'Credit card payment', // pagamento de fatura (duplica o gasto da compra no cartão)
	'Internal transfer' // marcada pelo app: espelho entre contas do próprio usuário
]);

// Descrições que indicam transferência interna mesmo quando a categoria da API
// é a genérica "Transfers". O Nubank lança o pagamento da fatura com descrição
// "Pagamento de fatura" na conta corrente (categoria "Transfers") e "Pagamento
// recebido" no cartão (categoria "Credit card payment" — já excluída acima).
// Sem isso o mesmo gasto entra duas vezes: na compra do cartão E no pagamento.
export const INTERNAL_TRANSFER_DESCRIPTIONS = new Set([
	'Pagamento de fatura',
	'Pagamento recebido'
]);

export function isInternalTransfer(
	pluggyCategory: string | null | undefined,
	description?: string | null
): boolean {
	const byCategory =
		pluggyCategory !== null && pluggyCategory !== undefined
			? INTERNAL_TRANSFER_CATEGORIES.has(pluggyCategory)
			: false;
	if (byCategory) return true;
	return description ? INTERNAL_TRANSFER_DESCRIPTIONS.has(description) : false;
}
