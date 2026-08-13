// Curated provider/model list for the onboarding dropdown (ESCOPO.md §2.2).
// Model ids change over time — check them against the provider's own docs
// before updating this list.
//
// `supportsDocuments` gates the PDF upload (ESCOPO.md §2.4): only models with
// native document understanding show up as eligible for the statement/invoice
// fallback. Never swap the model out from under the user when the chosen one
// does not support it — the UI has to disable the upload with an explicit
// message (BYOK: the user controls cost and provider).
export const AI_PROVIDERS = {
	deepseek: {
		label: 'DeepSeek',
		models: [
			{ id: 'deepseek-v4-pro', supportsDocuments: false },
			{ id: 'deepseek-v4-flash', supportsDocuments: false }
		]
	},
	anthropic: {
		label: 'Anthropic',
		models: [
			{ id: 'claude-sonnet-5', supportsDocuments: true },
			{ id: 'claude-opus-4-8', supportsDocuments: true },
			{ id: 'claude-haiku-4-5-20251001', supportsDocuments: true }
		]
	},
	openai: {
		label: 'OpenAI',
		models: [
			{ id: 'gpt-5.1', supportsDocuments: true },
			{ id: 'gpt-5.1-mini', supportsDocuments: true }
		]
	}
} as const;

export type AiProvider = keyof typeof AI_PROVIDERS;

export function modelSupportsDocuments(provider: AiProvider, modelId: string): boolean {
	return AI_PROVIDERS[provider].models.some((m) => m.id === modelId && m.supportsDocuments);
}
