<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<div class="overflow-hidden rounded-lg border border-rule">
	<div class="flex items-center gap-2 border-b border-rule bg-paper-raised px-4 py-2.5">
		<span class="size-2.5 bg-ctp-red"></span>
		<span class="size-2.5 bg-ctp-yellow"></span>
		<span class="size-2.5 bg-ctp-green"></span>
		<span class="ml-2 font-mono text-xs text-ink-soft">{title}</span>
	</div>
	<div class="bg-paper p-4">
		{@render children?.()}
	</div>
</div>
