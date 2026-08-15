import type { ApexOptions } from 'apexcharts';
import { formatCurrencyLabel } from '$lib/lib/format';

// Shared horizontal bar chart preset (horizontal bar with label at the tip of the
// bar). Used by the dashboard (top categories) and the categories page — the
// differences between them are parametric, not two separate configs.
export function horizontalBarOptions({
	categories,
	distributed = false,
	showLegend = false,
	showValues = true,
	borderRadius = 0,
	offsetX = 16,
	fontSize = '10px',
	barHeight
}: {
	categories: string[];
	distributed?: boolean;
	showLegend?: boolean;
	// When false the bars render without their value label — a qualitative,
	// ranking-style chart (the dashboard's "top categorias"). The categories
	// page keeps the exact values on.
	showValues?: boolean;
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
		dataLabels: showValues
			? {
					enabled: true,
					offsetX,
					textAnchor: 'start',
					formatter: formatCurrencyLabel,
					style: { fontFamily: 'JetBrains Mono, monospace', fontSize }
				}
			: { enabled: false },
		...(showLegend ? { legend: { show: true, position: 'top' } } : {})
	};
}
