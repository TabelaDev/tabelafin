<script lang="ts">
	import { resolve } from '$app/paths';
	import { ThemeToggle } from '@tabeladev/tabelawebui';

	let { children } = $props();
</script>

<div class="mx-auto flex min-h-svh w-full max-w-5xl flex-col border-x border-rule">
	<header class="sticky top-0 z-40 border-b border-rule bg-paper/80 backdrop-blur-sm">
		<div class="flex h-14 items-center justify-between gap-4 px-6">
			<a href={resolve('/')} class="font-mono text-sm font-semibold tracking-tight">tabelafin</a>
			<ThemeToggle />
		</div>
	</header>
	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>
</div>
