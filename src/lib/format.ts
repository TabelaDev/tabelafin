// Formatação de moeda em BRL com compactação opcional: valores grandes ficam
// legíveis ("R$ 2,5 mil", "R$ 1,2 M") em vez de uma linha de dígitos.
//
// Usa Intl.NumberFormat com notation:'compact' do próprio runtime — nada de
// tabela manual de sufixos — e `maximumFractionDigits` pra não virar
// "R$ 2,53 mil" quando não precisa.

const compactBRL = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRL',
	notation: 'compact',
	maximumFractionDigits: 1
});

const fullBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCompactCurrency(value: number, threshold = 100_000): string {
	return Math.abs(value) >= threshold ? compactBRL.format(value) : fullBRL.format(value);
}

// Formato compacto "cru" (sem moeda), pra eixos de gráfico e tooltips: ex.
// "2,5 mil", "1,2 M". Usado quando o prefixo "R$" já aparece no contexto.
export function formatCompactNumber(value: number, threshold = 100_000): string {
	if (Math.abs(value) < threshold) return value.toLocaleString('pt-BR');
	return new Intl.NumberFormat('pt-BR', {
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(value);
}
