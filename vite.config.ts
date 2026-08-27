import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

function devPort() {
	try {
		const cwd = process.cwd();
		const line = readFileSync(`${process.env.HOME}/.config/dev-ports.yaml`, 'utf8')
			.split('\n')
			.find((l) => l.startsWith(`${cwd}: `));
		if (line) return Number(line.slice(cwd.length + 2));
	} catch {
		/* dev-ports.yaml may not exist yet */
	}
	return parseInt(process.env.DEV_PORT || '5173', 10);
}

export default defineConfig({
	server: {
		port: devPort()
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// config: 'wrangler.adapter.jsonc' — not the real wrangler.jsonc. See
			// comment in that file: prevents the adapter from overwriting
			// worker/entry.js (the wrapper that adds the `scheduled` handler).
			adapter: adapter({ config: 'wrangler.adapter.jsonc' }),
			// Content-Security-Policy. Written here rather than as a header in
			// hooks.server.ts because SvelteKit emits inline hydration scripts: only
			// the framework knows their hashes, and a hand-written policy either
			// blocks hydration or has to allow 'unsafe-inline', which defeats it.
			// `mode: 'auto'` uses nonces on dynamically rendered pages and hashes on
			// prerendered ones.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					// 'wasm-unsafe-eval' is required by the Typst compiler that renders
					// the report PDF in the browser. It permits WebAssembly compilation
					// only — not eval() or inline script — so it does not reopen the
					// hole the rest of this policy closes.
					'script-src': ['self', 'wasm-unsafe-eval'],
					// 'unsafe-inline' for styles only: Svelte emits scoped inline styles
					// and the charts set style attributes from data. Style injection is
					// not an execution primitive, so this is the one concession worth
					// making.
					'style-src': ['self', 'unsafe-inline'],
					// data: covers the inline SVG icons; blob: the generated PDF.
					'img-src': ['self', 'data:', 'blob:'],
					'font-src': ['self', 'data:'],
					// The app itself talks only to its own origin — the AI providers and
					// Meu Pluggy are reached from the Worker, never from the browser.
					// jsDelivr is the exception: reports/+page.svelte fetches the Typst
					// WASM from there at runtime. Self-hosting it would be better (it
					// also makes the PDF button work offline and on restricted
					// networks), but that means adding two multi-megabyte packages as
					// dependencies — worth doing, not worth blocking this on.
					'connect-src': ['self', 'https://cdn.jsdelivr.net'],
					'worker-src': ['self', 'blob:'],
					'frame-ancestors': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'object-src': ['none']
				}
			},
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		}),
		SvelteKitPWA({
			strategies: 'generateSW',
			registerType: 'prompt',
			manifest: {
				name: 'TabelaFin',
				short_name: 'TabelaFin',
				description:
					'Finanças pessoais sem lançamento manual — sync automático via Open Finance e categorização com IA.',
				theme_color: '#18181b',
				background_color: '#18181b',
				display: 'standalone',
				start_url: '/',
				icons: [
					{ src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				// /api and /auth must never be served from cache (session/BYOK per request).
				// Navigations (page routes) are server-rendered on Cloudflare Workers,
				// not static — always go to the network.
				runtimeCaching: [
					{
						urlPattern: ({ url }) =>
							url.pathname.startsWith('/api') || url.pathname.startsWith('/auth'),
						handler: 'NetworkOnly'
					},
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkOnly'
					}
				],
				// generateSW doesn't allow custom code directly in the generated SW, but
				// accepts importScripts — used here for the `push` listener
				// (monthly report ready notification, see static/sw-push.js and
				// src/lib/server/push/reports.ts). Switching to `injectManifest`
				// wasn't necessary.
				importScripts: ['sw-push.js']
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
