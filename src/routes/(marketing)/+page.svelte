<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import BadgeDollarSignIcon from '@lucide/svelte/icons/badge-dollar-sign';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CodeXmlIcon from '@lucide/svelte/icons/code-xml';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import SmartphoneIcon from '@lucide/svelte/icons/smartphone';
	import TagsIcon from '@lucide/svelte/icons/tags';
	import { Button, Landing, SectionHeading } from '@tabeladev/tabelawebui';

	const REPO_URL = 'https://github.com/TabelaDev/tabelafin';

	const TITLE = 'TabelaFin — suas finanças sem mistério';
	const DESCRIPTION =
		'Open Finance, categorização por regras locais ou pela sua própria chave de IA, e os números numa tabela direta. Sem assinatura: seus dados ficam no seu banco.';

	const canonical = $derived(`${page.url.origin}${page.url.pathname}`);

	const steps = [
		{
			number: '01',
			color: 'var(--ctp-mauve)',
			title: 'Suas contas entram',
			body: 'Conecta o Open Finance e as transações sincronizam sozinhas. Sem conta? Você lança manualmente — do mesmo jeito simples.'
		},
		{
			number: '02',
			color: 'var(--ctp-sapphire)',
			title: 'Tudo é categorizado',
			body: 'Regras locais ou sua própria chave de IA classificam cada lançamento. Nada de caixa preta: você vê e ajusta a categoria quando quiser.'
		},
		{
			number: '03',
			color: 'var(--ctp-peach)',
			title: 'Os números falam',
			body: 'Saldo por conta, gastos do mês, top categorias e a evolução do seu dinheiro em gráficos diretos.'
		},
		{
			number: '04',
			color: 'var(--ctp-green)',
			title: 'Você decide',
			body: 'Seus dados ficam no seu banco. Sem IA nem Open Finance, o app continua funcionando só com a planilha que você preencher.'
		}
	];

	const features = [
		{
			icon: keyIcon,
			iconBg: 'color-mix(in srgb, var(--ctp-mauve) 12%, transparent)',
			iconColor: 'var(--ctp-mauve)',
			title: 'IA opcional, regras sempre',
			body: 'Sem API key, o TabelaFin categoriza por regras locais rápidas. Com a sua chave, você escolhe o provedor e o modelo — e paga direto pra eles.'
		},
		{
			icon: shieldIcon,
			iconBg: 'color-mix(in srgb, var(--ctp-sapphire) 12%, transparent)',
			iconColor: 'var(--ctp-sapphire)',
			title: 'Seus dados, seu banco',
			body: 'Tudo fica no seu banco de dados, na sua conta. As credenciais de IA e do Open Finance ficam criptografadas.'
		},
		{
			icon: landmarkIcon,
			iconBg: 'color-mix(in srgb, var(--ctp-green) 12%, transparent)',
			iconColor: 'var(--ctp-green)',
			title: 'Open Finance ou manual',
			body: 'Sincroniza suas contas pelo Pluggy, ou lança cada transação à mão. Funciona dos dois jeitos, com a mesma tabela unificada.'
		},
		{
			icon: chartIcon,
			iconBg: 'color-mix(in srgb, var(--ctp-peach) 12%, transparent)',
			iconColor: 'var(--ctp-peach)',
			title: 'Gráficos honestos',
			body: 'Evolução do saldo, top categorias e composição de gastos — sem promessa de "planos de aposentadoria". Só os números reais.'
		},
		{
			icon: fileUpIcon,
			iconBg: 'color-mix(in srgb, var(--ctp-yellow) 12%, transparent)',
			iconColor: 'var(--ctp-yellow)',
			title: 'Importa extrato em PDF',
			body: 'Colou o extrato de um banco que não tem Open Finance? Faz upload do PDF e as transações entram na mesma tabela.'
		},
		{
			icon: tagsIcon,
			iconBg: 'color-mix(in srgb, var(--ctp-blue) 12%, transparent)',
			iconColor: 'var(--ctp-blue)',
			title: 'Categorias que você controla',
			body: 'Cada categoria tem cor, e cada regra de categorização fica visível e editável. Você entende por que cada lançamento foi pra onde foi.'
		}
	];

	const roadmap = [
		{ icon: phoneIcon, label: 'Push das suas contas' },
		{ icon: checkIcon, label: 'Orçamentos por categoria' },
		{ icon: badgeDollarIcon, label: 'Exportação em CSV' }
	];
</script>

{#snippet heroTitle()}
	Tabela<span style="color: var(--twui-accent);">Fin</span>
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
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="TabelaFin" />
	<meta property="og:locale" content="pt_BR" />
	<meta property="og:title" content={TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:url" content={canonical} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={TITLE} />
	<meta name="twitter:description" content={DESCRIPTION} />
</svelte:head>

<div class="relative flex w-full flex-1 flex-col">
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-150"
		style="background-image: var(--gradient-hero)"
	></div>

	<div class="flex w-full flex-col gap-24 px-6 pt-16 pb-8 md:pt-24">
		<Landing.Hero
			eyebrow="Suas finanças sem mistério"
			title={heroTitle}
			lead="O TabelaFin conecta Open Finance, categoriza com regras locais ou a sua própria IA e mostra os números numa tabela direta. Sem assinatura, sem planos empurrados — seus dados ficam no seu banco."
			note="Cola seu token de acesso e configura IA e Open Finance só se quiser."
		>
			{#snippet actions()}
				<Button href={resolve('/signup')} variant="primary" size="lg">Começar</Button>
				<Button href={REPO_URL} target="_blank" rel="noreferrer" variant="outline" size="lg">
					<CodeXmlIcon class="size-4" />
					Ver o código
				</Button>
			{/snippet}
		</Landing.Hero>

		<section class="flex flex-col gap-8">
			<SectionHeading eyebrow="Como funciona" title="Quatro passos e seus números fazem sentido." />
			<Landing.Steps {steps} />
		</section>

		<section class="flex flex-col gap-8">
			<SectionHeading
				eyebrow="Recursos"
				title="O que ele faz e o que ele não faz com os seus dados."
			/>
			<Landing.Features {features} />
		</section>

		<section class="flex flex-col gap-8">
			<SectionHeading
				eyebrow="No radar"
				title="O que vem depois."
				lead="Nada disso existe ainda. Tá aqui porque o roadmap é público — igual o código."
			/>
			<Landing.Roadmap items={roadmap} />
		</section>

		<Landing.Footer
			name="tabelafin"
			license="AGPL-3.0 · SvelteKit + Cloudflare Workers"
			repoUrl={REPO_URL}
		/>
	</div>
</div>
