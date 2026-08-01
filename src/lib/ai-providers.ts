// Lista curada de providers/modelos pro dropdown de onboarding (ESCOPO.md §2.2).
// IDs de modelo mudam com o tempo — confirmar contra a documentação oficial do
// provider antes de atualizar esta lista.
//
// `supportsDocuments` gateia o upload de PDF (ESCOPO.md §2.4): só modelos com
// document understanding nativo aparecem como elegíveis pro fallback de
// fatura/extrato. Nunca trocar de modelo por baixo dos panos quando o
// escolhido não suporta — a UI deve desabilitar o upload com mensagem
// explícita (BYOK: o usuário controla custo/provedor).
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
