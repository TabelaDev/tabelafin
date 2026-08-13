import type { ApexOptions } from 'apexcharts';
import { formatCurrencyLabel } from '$lib/lib/format';

// Shared horizontal bar chart preset (barra horizontal com rótulo na ponta da
// barra). Usado pelo dashboard (top categorias) e pela página de categorias —
// as diferenças entre eles são paramétricas, não duas configs separadas.
export function horizontalBarOptions({
	categories,
	distributed = false,
	showLegend = false,
	borderRadius = 0,
	offsetX = 16,
	fontSize = '10px',
	barHeight
}: {
	categories: string[];
	distributed?: boolean;
	showLegend?: boolean;
	borderRadius?: number;
	offsetX?: number;
	fontSize?: string;
	barHeight?: string;
}): ApexOptions {
	return {
		plotOptions: {
			bar: {
				horizontal: true,
				borderRadius,
				// `distributed` gives each bar its own palette colour AND turns the
				// legend into a per-category list. Clicks are handled by the page
				// (onLegendClick) because ApexCharts disables its own legend toggle
				// on distributed bar charts.
				...(distributed ? { distributed: true } : {}),
				...(barHeight ? { barHeight } : {}),
				// Anchors the label at the tip (end) of the bar instead of the
				// middle — with `offsetX` + `textAnchor:'start'` it sits outside
				// the bar, to the right, so short bars don't cram the value inside
				// the accent fill.
				dataLabels: { position: 'top' }
			}
		},
		xaxis: { categories },
		dataLabels: {
			enabled: true,
			offsetX,
			textAnchor: 'start',
			formatter: formatCurrencyLabel,
			style: { fontFamily: 'JetBrains Mono, monospace', fontSize }
		},
		...(showLegend ? { legend: { show: true, position: 'top' } } : {})
	};
}
