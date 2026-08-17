<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button, ThemeToggle, Wordmark } from '@tabeladev/tabelawebui';

	let { children } = $props();
</script>

<div class="mx-auto flex min-h-svh w-full max-w-5xl flex-col border-x border-rule">
	<header class="sticky top-0 z-40 border-b border-rule bg-paper/60 backdrop-blur-sm">
		<div class="flex h-14 items-center justify-between gap-4 px-6">
			<a href={resolve('/')} class="font-mono text-sm font-semibold tracking-tight">
				<Wordmark prefix="Tabela" suffix="Fin" />
			</a>
			<div class="flex items-center gap-2">
				<!-- The public site had exactly two outbound links — /signup and GitHub.
				     Someone coming back after their cookie expired had to guess /login. -->
				<Button href={resolve('/login')} variant="ghost" size="sm">Entrar</Button>
				<ThemeToggle />
			</div>
		</div>
	</header>
	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>
	<footer class="border-t border-rule px-6 py-4">
		<nav class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-xs">
			<a href={resolve('/privacidade')} class="text-ink-soft hover:text-ink">Privacidade</a>
			<span class="text-ink-faint">·</span>
			<a href={resolve('/termos')} class="text-ink-soft hover:text-ink">Termos de uso</a>
			<span class="text-ink-faint">·</span>
			<a
				href="https://github.com/TabelaDev/tabelafin"
				rel="noreferrer"
				class="text-ink-soft hover:text-ink">Código-fonte</a
			>
		</nav>
	</footer>
</div>
