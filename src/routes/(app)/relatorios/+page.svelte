<script lang="ts">
	import { Button, Card } from '@tabeladev/tabelawebui';
	import { formatCompactCurrency } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isGenerating = $state(false);
	let error = $state('');

	async function generatePdf() {
		if (!data.latestReport) return;

		isGenerating = true;
		error = '';

		try {
			// Dynamic import to avoid SSR issues with WASM
			const typstModule = await import('@myriaddreamin/typst.ts');
			const typst = typstModule.$typst;

			// Configure WASM modules from CDN
			typst.setCompilerInitOptions({
				getModule: () =>
					'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'
			});
			typst.setRendererInitOptions({
				getModule: () =>
					'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm'
			});

			const report = data.latestReport;
			const summary = report.summary as {
				totalIncome?: number;
				totalExpense?: number;
				categoryTotals?: Record<string, number>;
				investmentBalance?: number;
				narrative?: string;
				suggestions?: string[];
			};

			const income = summary.totalIncome ?? 0;
			const expense = summary.totalExpense ?? 0;
			const balance = income - expense;
			const investment = summary.investmentBalance ?? 0;
			const categories = Object.entries(summary.categoryTotals ?? {})
				.map(([name, amount]) => ({
					name,
					amount: formatCompactCurrency(amount),
					value: amount,
					percentage: expense > 0 ? `${((amount / expense) * 100).toFixed(1)}%` : '0%'
				}))
				.sort((a, b) => b.value - a.value);

			const suggestions = summary.suggestions ?? [
				'Analise seus gastos por categorias para identificar oportunidades de economia.'
			];

			// Build Typst source
			const typstSource = `
#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
)

#set text(font: "JetBrains Mono", size: 10pt, fill: rgb("#1a1a2e"))
#set par(justify: true, leading: 0.65em)

// Capa
#align(center + horizon)[
  #text(size: 28pt, weight: "bold", fill: rgb("#6c5ce7"))[TabelaFin]
  #v(0.5cm)
  #text(size: 18pt)[Relatório Financeiro Mensal]
  #v(0.3cm)
  #text(size: 14pt, fill: rgb("#666"))[${report.yearMonth}]
  #v(1cm)
  #text(size: 11pt, fill: rgb("#888"))[Gerado em ${new Date().toLocaleDateString('pt-BR')}]
]

#pagebreak()

// Resumo
= Resumo Executivo

${summary.narrative ?? 'Relatório financeiro do mês.'}

#v(0.5cm)

// Indicadores
= Indicadores do Mês

#{
  table(
    columns: (1fr, auto),
    align: (left, right),
    stroke: rgb("#e0e0e0"),
    inset: 10pt,
    table.header(
      text(weight: "bold")[Indicador],
      text(weight: "bold")[Valor]
    ),
    [Renda Total], text(fill: rgb("#00b894"))[+ ${formatCompactCurrency(income)}],
    [Gastos Totais], text(fill: rgb("#d63031"))[- ${formatCompactCurrency(expense)}],
    [Saldo do Mês], text(weight: "bold")[${formatCompactCurrency(balance)}],
    [Saldo em Investimentos], [${formatCompactCurrency(investment)}],
  )
}

#v(0.5cm)

// Gastos por Categoria
= Gastos por Categoria

#{
  table(
    columns: (1fr, auto, auto),
    align: (left, right, right),
    stroke: rgb("#e0e0e0"),
    inset: 10pt,
    table.header(
      text(weight: "bold")[Categoria],
      text(weight: "bold")[Valor],
      text(weight: "bold")[%]
    ),
    ${categories.map((c) => `[${c.name}], [${c.amount}], [${c.percentage}]`).join(',\n    ')}
  )
}

#v(0.5cm)

// Sugestões
= Sugestões de Economia

${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}
`;

			const pdfData = await typst.pdf({ mainContent: typstSource });

			if (!pdfData) {
				throw new Error('Falha ao gerar PDF');
			}

			// Download PDF
			const blob = new Blob([new Uint8Array(pdfData)], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `tabelafin-${report.yearMonth}.pdf`;
			link.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Erro ao gerar PDF';
		} finally {
			isGenerating = false;
		}
	}
</script>

<svelte:head>
	<title>Relatórios — TabelaFin</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<header>
		<h1 class="font-mono text-2xl font-bold">Relatórios</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span> Gere relatórios em PDF das suas finanças.
		</p>
	</header>

	{#if data.latestReport}
		<Card>
			<div class="flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="font-mono text-sm font-semibold">
							Relatório de {data.latestReport.yearMonth}
						</h2>
						<p class="mt-1 font-mono text-xs text-ink-soft">
							Gerado em {new Date(data.latestReport.generatedAt).toLocaleDateString('pt-BR')}
						</p>
					</div>
					<Button onclick={generatePdf} disabled={isGenerating} size="sm">
						{isGenerating ? 'Gerando...' : 'Baixar PDF'}
					</Button>
				</div>

				{#if error}
					<p class="font-mono text-sm text-destructive">{error}</p>
				{/if}

				<!-- Preview do relatório -->
				<div class="bg-paper-inset border border-rule p-4">
					<p class="font-mono text-sm text-ink">
						{data.latestReport.summary.narrative ?? 'Relatório financeiro do mês.'}
					</p>
				</div>
			</div>
		</Card>
	{:else}
		<Card>
			<p class="py-4 text-center font-mono text-sm text-ink-soft">
				Nenhum relatório disponível ainda. Os relatórios são gerados automaticamente no dia 1 de
				cada mês.
			</p>
		</Card>
	{/if}
</div>
