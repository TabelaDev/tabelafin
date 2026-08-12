<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Button,
		ThemeToggle,
		LandingHero,
		LandingSteps,
		LandingFeatures,
		LandingRoadmap,
		LandingFooter,
		SectionHeading
	} from '@tabeladev/tabelawebui';
	import CodeXmlIcon from '@lucide/svelte/icons/code-xml';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import SmartphoneIcon from '@lucide/svelte/icons/smartphone';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import TagsIcon from '@lucide/svelte/icons/tags';
	import BadgeDollarSignIcon from '@lucide/svelte/icons/badge-dollar-sign';

	const REPO_URL = 'https://github.com/TabelaDev/tabelafin';

	const steps = [
		{
			number: '01',
			color: 'var(--color-ctp-mauve)',
			title: 'Suas contas entram',
			body: 'Conecta o Open Finance e as transações sincronizam sozinhas. Sem conta? Você lança manualmente — do mesmo jeito simples.'
		},
		{
			number: '02',
			color: 'var(--color-ctp-sapphire)',
			title: 'Tudo é categorizado',
			body: 'Regras locais ou sua própria chave de IA classificam cada lançamento. Nada de caixa preta: você vê e ajusta a categoria quando quiser.'
		},
		{
			number: '03',
			color: 'var(--color-ctp-peach)',
			title: 'Os números falam',
			body: 'Saldo por conta, gastos do mês, top categorias e a evolução do seu dinheiro em gráficos diretos.'
		},
		{
			number: '04',
			color: 'var(--color-ctp-green)',
			title: 'Você decide',
			body: 'Seus dados ficam no seu banco. Sem IA nem Open Finance, o app continua funcionando só com a planilha que você preencher.'
		}
	];
</script>

{#snippet heroTitle()}
	<span class="block">Suas contas.</span>
	<span class="block">Sua chave de IA.</span>
	<span class="block">Zero caixa preta.</span>
{/snippet}
{#snippet heroActions()}
	<Button href={resolve('/signup')} variant="primary" size="lg" class="shadow-glow">Começar</Button>
	<Button href={REPO_URL} target="_blank" rel="noreferrer" variant="outline" size="lg">
		<CodeXmlIcon class="size-4" />
		Ver o código
	</Button>
{/snippet}

{#snippet keyIcon()}
	<KeyRoundIcon class="twui-landing-feature-svg" />
{/snippet}
{#snippet shieldIcon()}
	<ShieldCheckIcon class="twui-landing-feature-svg" />
{/snippet}
{#snippet landmarkIcon()}
	<LandmarkIcon class="twui-landing-feature-svg" />
{/snippet}
{#snippet chartIcon()}
	<ChartLineIcon class="twui-landing-feature-svg" />
{/snippet}
{#snippet fileUpIcon()}
	<FileUpIcon class="twui-landing-feature-svg" />
{/snippet}
{#snippet tagsIcon()}
	<TagsIcon class="twui-landing-feature-svg" />
{/snippet}

{#snippet phoneIcon()}
	<SmartphoneIcon class="twui-landing-roadmap-icon" />
{/snippet}
{#snippet checkIcon()}
	<CircleCheckIcon class="twui-landing-roadmap-icon" />
{/snippet}
{#snippet badgeDollarIcon()}
	<BadgeDollarSignIcon class="twui-landing-roadmap-icon" />
{/snippet}

<svelte:head>
	<title>TabelaFin</title>
</svelte:head>

<div class="relative flex w-full flex-1 flex-col">
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-150"
		style="background-image: var(--gradient-hero)"
	></div>

	<div class="mx-auto flex w-full max-w-5xl flex-1 flex-col border-x border-rule">
		<header class="sticky top-0 z-40 border-b border-rule bg-background/80 backdrop-blur-sm">
			<div class="flex h-14 items-center justify-between gap-4 px-6">
				<a href={resolve('/')} class="font-mono text-sm font-semibold tracking-tight">tabelafin</a>
				<div class="flex items-center gap-2">
					<ThemeToggle />
					<Button href={resolve('/signup')} size="sm">Começar</Button>
				</div>
			</div>
		</header>

		<div class="flex flex-col gap-24 px-6 pt-16 pb-8 md:pt-24">
			<LandingHero
				eyebrow="Suas finanças sem mistério"
				title={heroTitle}
				lead="O TabelaFin conecta Open Finance, categoriza com regras locais ou a sua própria IA e mostra os números numa tabela direta. Sem assinatura, sem planos empurrados — seus dados ficam no seu banco."
				actions={heroActions}
				note="Cola seu token de acesso e configura IA e Open Finance só se quiser."
			/>

			<section class="flex flex-col gap-8">
				<SectionHeading
					eyebrow="Como funciona"
					title="Quatro passos, e seus números fazem sentido."
				/>
				<LandingSteps {steps} />
			</section>

			<section class="flex flex-col gap-8">
				<SectionHeading
					eyebrow="Recursos"
					title="O que ele faz e o que ele não faz com os seus dados."
				/>
				<LandingFeatures
					features={[
						{
							icon: keyIcon,
							iconBg: 'color-mix(in srgb, var(--color-ctp-mauve) 12%, transparent)',
							iconColor: 'var(--color-ctp-mauve)',
							title: 'IA opcional, regras sempre',
							body: 'Sem API key, o TabelaFin categoriza por regras locais rápidas. Com a sua chave, você escolhe o provedor e o modelo — e paga direto pra eles.'
						},
						{
							icon: shieldIcon,
							iconBg: 'color-mix(in srgb, var(--color-ctp-sapphire) 12%, transparent)',
							iconColor: 'var(--color-ctp-sapphire)',
							title: 'Seus dados, seu banco',
							body: 'Tudo fica no seu banco de dados, na sua conta. As credenciais de IA e do Open Finance ficam criptografadas.'
						},
						{
							icon: landmarkIcon,
							iconBg: 'color-mix(in srgb, var(--color-ctp-green) 12%, transparent)',
							iconColor: 'var(--color-ctp-green)',
							title: 'Open Finance ou manual',
							body: 'Sincroniza suas contas pelo Pluggy, ou lança cada transação à mão. Funciona dos dois jeitos, com a mesma tabela unificada.'
						},
						{
							icon: chartIcon,
							iconBg: 'color-mix(in srgb, var(--color-ctp-peach) 12%, transparent)',
							iconColor: 'var(--color-ctp-peach)',
							title: 'Gráficos honestos',
							body: 'Evolução do saldo, top categorias e composição de gastos — sem promessa de "planos de aposentadoria". Só os números reais.'
						},
						{
							icon: fileUpIcon,
							iconBg: 'color-mix(in srgb, var(--color-ctp-yellow) 12%, transparent)',
							iconColor: 'var(--color-ctp-yellow)',
							title: 'Importa extrato em PDF',
							body: 'Colou o extrato de um banco que não tem Open Finance? Faz upload do PDF e as transações entram na mesma tabela.'
						},
						{
							icon: tagsIcon,
							iconBg: 'color-mix(in srgb, var(--color-ctp-blue) 12%, transparent)',
							iconColor: 'var(--color-ctp-blue)',
							title: 'Categorias que você controla',
							body: 'Cada categoria tem cor, e cada regra de categorização fica visível e editável. Você entende por que cada lançamento foi pra onde foi.'
						}
					]}
				/>
			</section>

			<section class="flex flex-col gap-8">
				<SectionHeading
					eyebrow="No radar"
					title="O que vem depois."
					lead="Nada disso existe ainda. Tá aqui porque o roadmap é público — igual o código."
				/>
				<LandingRoadmap
					items={[
						{ icon: phoneIcon, label: 'Push das suas contas' },
						{ icon: checkIcon, label: 'Orçamentos por categoria' },
						{ icon: badgeDollarIcon, label: 'Exportação em CSV' }
					]}
				/>
			</section>

			<LandingFooter
				name="tabelafin"
				license="AGPL-3.0 · SvelteKit + Cloudflare Workers"
				repoUrl={REPO_URL}
			/>
		</div>
	</div>
</div>
