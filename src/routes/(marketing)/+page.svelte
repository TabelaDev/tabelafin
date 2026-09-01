<script lang="ts">
	import { PUBLIC_TABELAUTH_URL } from '$env/static/public';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
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
	import { Button, Landing, Wordmark } from '@tabeladev/tabelawebui';

	const REPO_URL = 'https://github.com/TabelaDev/tabelafin';

	const TITLE = 'TabelaFin';
	const DESCRIPTION =
		'Open Finance, categorização por regras locais ou pela sua própria chave de IA, e os números numa tabela direta. Sem assinatura: a chave de IA é sua e o código é aberto.';

	const canonical = $derived(`${page.url.origin}${page.url.pathname}`);

	const steps = [
		{
			number: '01',
			color: 'var(--ctp-mauve)',
			title: 'Suas contas entram',
			body: 'Conecte sua conta do Meu Pluggy e nós sincronizamos suas transações de maneira automática. Não possui uma conta? Você ainda pode lançar os dados manualmente de forma simplificada.'
		},
		{
			number: '02',
			color: 'var(--ctp-sapphire)',
			title: 'Tudo é categorizado',
			body: 'Regras locais ou sua própria chave de IA classificam cada lançamento. Sem algoritmo misterioso: você vê e ajusta as regras quando e como quiser.'
		},
		{
			number: '03',
			color: 'var(--ctp-peach)',
			title: 'Entenda os seus números',
			body: 'Saldo por conta, gastos do mês, top categorias e a evolução do seu dinheiro em gráficos diretos.'
		},
		{
			number: '04',
			color: 'var(--ctp-green)',
			title: 'Você controla os seus dados',
			body: 'Open source (AGPL): audite o código ou rode você mesmo. Sem IA nem Open Finance, o app continua funcionando só com a planilha que você preencher.'
		}
	];

	const features = [
		{
			icon: keyIcon,
			iconBg: 'color-mix(in srgb, var(--ctp-mauve) 12%, transparent)',
			iconColor: 'var(--ctp-mauve)',
			title: 'IA opcional',
			body: 'Com sua chave de API você escolhe provedor e modelo, e paga direto pra eles, sem taxa nossa. Sem chave, as regras locais assumem a categorização. E dá pra ocultar a IA da plataforma por completo.'
		},
		{
			icon: shieldIcon,
			iconBg: 'color-mix(in srgb, var(--ctp-sapphire) 12%, transparent)',
			iconColor: 'var(--ctp-sapphire)',
			title: 'Suas credenciais criptografadas',
			body: 'Sua chave de IA e as credenciais do Open Finance ficam criptografadas no banco de dados, nada em texto puro.'
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
			body: 'Evolução do saldo, top categorias e composição de gastos, sem promessa de "planos de aposentadoria". Só os números reais.'
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
	<Wordmark prefix="Tabela" suffix="Fin" />
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

<Landing>
	<Landing.Hero
		eyebrow="Suas finanças sem mistério"
		title={heroTitle}
		lead="O TabelaFin conecta Open Finance, categoriza suas contas com regras locais ou com a sua própria IA e mostra os números numa tabela direta. Sem assinatura, sem planos empurrados: você controla o seu próprio custo."
		note="Crie sua conta e configure IA ou Open Finance apenas se quiser."
		justify
	>
		{#snippet actions()}
			<Button href="{PUBLIC_TABELAUTH_URL}/signup" variant="primary" size="lg">Começar</Button>
			<Button href={REPO_URL} target="_blank" rel="noreferrer" variant="outline" size="lg">
				<CodeXmlIcon class="size-4" />
				Ver o código
			</Button>
		{/snippet}
	</Landing.Hero>

	<Landing.Section>
		<Landing.Section.Heading
			eyebrow="Como funciona"
			title="Quatro passos e seus números fazem sentido."
		/>
		<Landing.Steps {steps} justify />
	</Landing.Section>

	<Landing.Section>
		<Landing.Section.Heading
			eyebrow="Recursos"
			title="O que ele faz e o que ele não faz com os seus dados."
		/>
		<Landing.Features {features} justify />
	</Landing.Section>

	<Landing.Section>
		<Landing.Section.Heading
			eyebrow="No radar"
			title="O que vem depois."
			lead="Nada disso existe ainda. Tá aqui porque o roadmap é público, igual ao código."
			justify
		/>
		<Landing.Roadmap items={roadmap} />
	</Landing.Section>
</Landing>
