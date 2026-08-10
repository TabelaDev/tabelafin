<script lang="ts">
	// A category chip coloured by the category's own accent.
	//
	// This used to be `<Badge style={...}>` from tabelawebui, but Badge takes
	// only variant/children/class and does not spread the rest — so the style
	// was dropped at runtime and every category rendered in the default grey.
	// The colour has to be inline because it comes from data: a Tailwind class
	// built at runtime is never seen by the JIT compiler.
	let {
		category,
		color = 'ctp-overlay1',
		brackets = true
	}: {
		category: string | null;
		/** Catppuccin token name, e.g. "ctp-peach". */
		color?: string;
		/** Wrap the name in [brackets], matching the app's mono look. */
		brackets?: boolean;
	} = $props();

	const accent = $derived(color.replace('ctp-', ''));
	const style = $derived(
		`background-color: color-mix(in oklab, var(--catppuccin-${accent}) 10%, transparent); color: var(--catppuccin-${accent});`
	);
</script>

<span class="twui-badge" {style}>
	{brackets ? `[${category}]` : category}
</span>

<style>
	/* Same box as tabelawebui's Badge; only the colours differ, and those come
	   from the category. */
	.twui-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 6px;
		border: 1px solid var(--twui-rule);
		font-family: var(--twui-font-mono, 'JetBrains Mono', monospace);
		font-size: 12px;
		line-height: 1.4;
	}
</style>
