/// <reference path="./svelte-kit-worker.d.ts" />
// Wrapper em torno do worker gerado pelo @sveltejs/adapter-cloudflare.
//
// A versão instalada do adapter (@sveltejs/adapter-cloudflare@^7) só gera um
// `_worker.js` com `export default { fetch }` — não há extensão documentada
// pra adicionar outros handlers (scheduled, queue, etc), ver
// https://github.com/sveltejs/kit/issues/13692. Mesmo padrão do TabelaCal:
// `wrangler.jsonc`'s `main` aponta pra este wrapper, que reexporta o `fetch`
// gerado pelo SvelteKit e adiciona `scheduled` por cima.
//
// O adapter é configurado (vite.config.ts: adapter({ config:
// 'wrangler.adapter.jsonc' })) pra ler uma config *separada* da wrangler.jsonc
// real, só pra continuar escrevendo o worker gerado no local default
// (.svelte-kit/cloudflare/_worker.js) em vez de sobrescrever este arquivo —
// ver comentário em wrangler.adapter.jsonc.
//
// Fica fora de `src/` de propósito: se ficasse dentro, o `svelte-check`
// type-checaria transitivamente o `_worker.js` gerado (um bundle Rollup
// grande e não tipado).
//
// `$lib` funciona aqui porque `wrangler.jsonc` declara `alias: { "$lib":
// "./src/lib" }`, resolvido pelo esbuild do wrangler (mesma ideia do alias do
// Vite, só que pro bundle que o wrangler gera a partir deste `main`).
import server from '../.svelte-kit/cloudflare/_worker.js';
import { syncAllUsers } from '$lib/server/pluggy/sync';
import { generateMonthlyReports } from '$lib/server/reports/generate';

export default {
	fetch: server.fetch,
	/**
	 * @param {ScheduledController} event
	 * @param {Env} env
	 * @param {ExecutionContext} ctx
	 */
	async scheduled(event, env, ctx) {
		// wrangler.jsonc declara dois crons: "0 6 * * *" (sync diário) e
		// "0 7 1 * *" (relatório mensal, dia 1) — event.cron distingue qual disparou.
		if (event.cron === '0 7 1 * *') {
			ctx.waitUntil(generateMonthlyReports(env));
		} else {
			ctx.waitUntil(syncAllUsers(env));
		}
	}
};
