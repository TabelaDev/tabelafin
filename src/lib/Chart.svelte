<script lang="ts">
	import ApexCharts, { type ApexOptions } from 'apexcharts';
	import { mode } from 'mode-watcher';
	import { formatCompactNumber } from '$lib/format';

	type ChartSeries = ApexOptions['series'];

	let {
		type,
		series,
		options
	}: { type: 'bar' | 'area' | 'donut'; series: ChartSeries; options?: ApexOptions } = $props();

	let container: HTMLDivElement;
	let chart: ApexCharts | null = null;

	// Cores do design system (Catppuccin Latte/Mocha) — mesmas do portfolio.
	// O accent vem do tema real (CSS var --twui-accent, definida via
	// data-accent no <html>) e é a 1ª cor da palette; as seguintes usam cores
	// bem distintas entre si e sem colidir com o accent.
	let accentColor = $state<string | null>(null);

	$effect(() => {
		const v = getComputedStyle(document.documentElement).getPropertyValue('--twui-accent').trim();
		if (v) accentColor = v;
	});

	let themeColors = $derived.by(() => {
		const isDark = mode.current === 'dark';
		const accent = accentColor ?? (isDark ? '#f5c2e7' : '#e64553');
		const palette = isDark
			? [accent, '#89b4fa', '#a6e3a1', '#94e2d5', '#cba6f7', '#f9e2af', '#fab387']
			: [accent, '#1e66f5', '#40a02b', '#179299', '#8839ef', '#df8e1d', '#04a5e5'];
		return {
			text: isDark ? '#cdd6f4' : '#4c4f69',
			soft: isDark ? '#a6adc8' : '#6c6f85',
			grid: isDark ? '#313244' : '#ccd0da',
			accent,
			paper: isDark ? '#1e1e2e' : '#eff1f5',
			palette
		};
	});

	// Merge profundo e simples: options por página sobrescrevem os defaults,
	// mas flags de estrutura (toolbar/zoom/legend) nunca são reativadas.
	function deepMerge<T>(base: T, override: T): T {
		if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
		if (base && override && typeof base === 'object' && typeof override === 'object') {
			const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
			for (const key of Object.keys(override as Record<string, unknown>)) {
				out[key] = deepMerge(
					(base as Record<string, unknown>)[key],
					(override as Record<string, unknown>)[key]
				);
			}
			return out as T;
		}
		return override ?? base;
	}

	const chartOptions = $derived.by(() => {
		const c = themeColors;
		const base: ApexOptions = {
			chart: {
				type,
				height: '100%',
				fontFamily: 'JetBrains Mono, monospace',
				foreColor: c.text,
				background: 'transparent',
				parentHeightOffset: 0,
				toolbar: { show: false, tools: {} },
				zoom: { enabled: false },
				animations: { enabled: true }
			},
			colors: c.palette,
			stroke: { curve: 'smooth', width: 2 },
			dataLabels: { enabled: false },
			grid: { borderColor: c.grid, strokeDashArray: 4 },
			xaxis: {
				labels: {
					style: { colors: c.text, fontFamily: 'JetBrains Mono, monospace' },
					// Mirror of the y axis rule: on a horizontal bar the value axis is
					// x, so it needs the same compact format, and on every other chart
					// this axis carries category names that must pass through intact.
					formatter: (value) =>
						typeof value === 'number' ? formatCompactNumber(value) : String(value ?? '')
				}
			},
			yaxis: {
				labels: {
					style: { colors: c.text, fontFamily: 'JetBrains Mono, monospace' },
					// Large values compact ("2,5 mil", "1,2 M") so the axis does not
					// fill up; below the threshold they stay whole.
					//
					// Only numbers go through the compact format. On a horizontal bar
					// the category axis IS the y axis, so Apex passes the category
					// name here — running that through Number() turned every category
					// label into "NaN". Page options cannot fix it from outside:
					// deepMerge keeps the base whenever the override is undefined.
					formatter: (value) =>
						typeof value === 'number' ? formatCompactNumber(value) : String(value ?? '')
				}
			},
			legend: { labels: { colors: c.text }, position: 'bottom' },
			tooltip: {
				theme: mode.current === 'dark' ? 'dark' : 'light',
				// Sem fundo colorido no donut (o Apex pinta o tooltip inteiro com
				// a cor do slice por padrão — fillSeriesColor:true). Com false,
				// todos os gráficos ficam com fundo neutro + bolinha colorida.
				fillSeriesColor: false,
				style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' },
				y: {
					// Formato BRL, igual aos cards/tabelas. O dashboard sobrescreve
					// com currency.format no donut via deepMerge (mesmo resultado).
					formatter: (value) =>
						Number(value).toLocaleString('pt-BR', {
							style: 'currency',
							currency: 'BRL'
						})
				}
			},
			fill: { type: type === 'area' ? 'gradient' : 'solid', opacity: 0.9 }
		};
		return deepMerge(base, options ?? {});
	});

	$effect(() => {
		if (!container) return;
		const s = series ?? [];
		if (!chart) {
			chart = new ApexCharts(container, { ...chartOptions, series: s });
			chart.render();
		} else {
			chart.updateOptions(chartOptions, false);
			chart.updateSeries(s);
		}
	});

	$effect(() => {
		return () => {
			chart?.destroy();
			chart = null;
		};
	});
</script>

<div bind:this={container} class="h-full w-full"></div>

<style>
	/* Legenda: afasta a bolinha do texto em todos os gráficos (o donut
	   cola sem isso). */
	:global(.apexcharts-legend-marker) {
		margin-right: 8px !important;
	}

	/* Tooltip: mono consistente em todos os gráficos, inclusive donut (que
	   tem layout próprio de tooltip). */
	:global(.apexcharts-tooltip) {
		font-family: var(--twui-font-mono, 'JetBrains Mono', monospace) !important;
	}
	:global(.apexcharts-tooltip-title) {
		font-family: var(--twui-font-mono, 'JetBrains Mono', monospace) !important;
	}
	:global(.apexcharts-tooltip-series-group) {
		font-family: var(--twui-font-mono, 'JetBrains Mono', monospace) !important;
	}
	:global(.apexcharts-tooltip-text-label),
	:global(.apexcharts-tooltip-text-value),
	:global(.apexcharts-tooltip-text-percentage) {
		font-family: var(--twui-font-mono, 'JetBrains Mono', monospace) !important;
	}
</style>
