<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button, Badge, Card, ThemeToggle } from '@tabeladev/tabelawebui';
	import TerminalWindow from '$lib/components/TerminalWindow.svelte';
	import SectionHeading from '$lib/components/SectionHeading.svelte';
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
			color: 'text-ctp-mauve',
			title: 'Suas contas entram',
			body: 'Conecta o Open Finance e as transações sincronizam sozinhas. Sem conta? Você lança manualmente — do mesmo jeito simples.'
		},
		{
			number: '02',
			color: 'text-ctp-sapphire',
			title: 'Tudo é categorizado',
			body: 'Regras locais ou sua própria chave de IA classificam cada lançamento. Nada de caixa preta: você vê e ajusta a categoria quando quiser.'
		},
		{
			number: '03',
			color: 'text-ctp-peach',
			title: 'Os números falam',
			body: 'Saldo por conta, gastos do mês, top categorias e a evolução do seu dinheiro em gráficos diretos.'
		},
		{
			number: '04',
			color: 'text-ctp-green',
			title: 'Você decide',
			body: 'Seus dados ficam no seu banco. Sem IA nem Open Finance, o app continua funcionando só com a planilha que você preencher.'
		}
	];

	const features = [
		{
			icon: KeyRoundIcon,
			bgClass: 'bg-ctp-mauve/12',
			textClass: 'text-ctp-mauve',
			title: 'IA opcional, regras sempre',
			body: 'Sem API key, o TabelaFin categoriza por regras locais rápidas. Com a sua chave, você escolhe o provedor e o modelo — e paga direto pra eles.'
		},
		{
			icon: ShieldCheckIcon,
			bgClass: 'bg-ctp-sapphire/12',
			textClass: 'text-ctp-sapphire',
			title: 'Seus dados, seu banco',
			body: 'Tudo fica no seu banco de dados, na sua conta. As credenciais de IA e do Open Finance ficam criptografadas.'
		},
		{
			icon: LandmarkIcon,
			bgClass: 'bg-ctp-green/12',
			textClass: 'text-ctp-green',
			title: 'Open Finance ou manual',
			body: 'Sincroniza suas contas pelo Pluggy, ou lança cada transação à mão. Funciona dos dois jeitos, com a mesma tabela unificada.'
		},
		{
			icon: ChartLineIcon,
			bgClass: 'bg-ctp-peach/12',
			textClass: 'text-ctp-peach',
			title: 'Gráficos honestos',
			body: 'Evolução do saldo, top categorias e composição de gastos — sem promessa de "planos de aposentadoria". Só os números reais.'
		},
		{
			icon: FileUpIcon,
			bgClass: 'bg-ctp-yellow/12',
			textClass: 'text-ctp-yellow',
			title: 'Importa extrato em PDF',
			body: 'Colou o extrato de um banco que não tem Open Finance? Faz upload do PDF e as transações entram na mesma tabela.'
		},
		{
			icon: TagsIcon,
			bgClass: 'bg-ctp-blue/12',
			textClass: 'text-ctp-blue',
			title: 'Categorias que você controla',
			body: 'Cada categoria tem cor, e cada regra de categorização fica visível e editável. Você entende por que cada lançamento foi pra onde foi.'
		}
	];

	const roadmap = [
		{ icon: SmartphoneIcon, label: 'Push das suas contas' },
		{ icon: CircleCheckIcon, label: 'Orçamentos por categoria' },
		{ icon: BadgeDollarSignIcon, label: 'Exportação em CSV' }
	];
</script>

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
		<!-- Header fixo: replica o chrome do tabelacal -->
		<header class="sticky top-0 z-40 border-b border-rule bg-background/80 backdrop-blur-sm">
			<div class="flex h-14 items-center justify-between gap-4 px-6">
				<a href={resolve('/')} class="font-mono text-sm font-semibold tracking-tight">tabelafin</a>
				<div class="flex items-center gap-2">
					<ThemeToggle />
					<Button href={resolve('/cadastro')} size="sm">Começar</Button>
				</div>
			</div>
		</header>

		<div class="flex flex-col gap-24 px-6 pt-16 pb-8 md:pt-24">
			<section class="flex flex-col gap-6 md:max-w-2xl">
				<p class="font-mono text-xs font-medium tracking-[0.2em] text-accent-ink uppercase">
					Suas finanças sem mistério
				</p>
				<h1 class="font-mono text-4xl font-bold tracking-tight text-balance md:text-6xl">
					<span class="block">Suas contas.</span>
					<span class="block">Sua chave de IA.</span>
					<span class="block">Zero caixa preta.</span>
				</h1>
				<p class="text-ink-soft md:text-lg">
					O TabelaFin conecta Open Finance, categoriza com regras locais ou a sua própria IA e
					mostra os números numa tabela direta. Sem assinatura, sem planos empurrados — seus dados
					ficam no seu banco.
				</p>
				<div class="flex flex-col items-start gap-2">
					<div class="flex flex-wrap gap-3">
						<Button href={resolve('/cadastro')} variant="primary" size="lg" class="shadow-glow"
							>Começar</Button
						>
						<Button href={REPO_URL} target="_blank" rel="noreferrer" variant="outline" size="lg">
							<CodeXmlIcon class="size-4" />
							Ver o código
						</Button>
					</div>
					<p class="text-xs text-ink-soft">
						Cola seu token de acesso e configura IA e Open Finance só se quiser.
					</p>
				</div>
			</section>

			<section aria-hidden="true">
				<TerminalWindow title="tabelafin — dashboard">
					<div class="flex flex-col gap-3">
						<p class="font-mono text-sm">
							<span class="text-accent-ink">$</span> status — saldo em {new Date().toLocaleDateString(
								'pt-BR',
								{ month: 'long' }
							)}
						</p>
						<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<Card>
								<p class="font-mono text-xs text-ink-soft">Saldo total</p>
								<p class="mt-1 font-mono text-lg font-bold text-accent">R$ 12.480,50</p>
							</Card>
							<Card>
								<p class="font-mono text-xs text-ink-soft">Gastos do mês</p>
								<p class="mt-1 font-mono text-lg font-bold text-ctp-red">R$ 3.240,15</p>
							</Card>
							<Card>
								<p class="font-mono text-xs text-ink-soft">Receitas</p>
								<p class="mt-1 font-mono text-lg font-bold text-ctp-green">R$ 5.100,00</p>
							</Card>
							<Card>
								<p class="font-mono text-xs text-ink-soft">Investimentos</p>
								<p class="mt-1 font-mono text-lg font-bold">R$ 8.400,00</p>
							</Card>
						</div>
						<div class="flex items-center justify-between border border-rule bg-paper p-3">
							<div class="flex items-center gap-3">
								<span class="size-3 bg-ctp-mauve"></span>
								<span class="font-mono text-sm">Mercado</span>
							</div>
							<span class="font-mono text-sm text-ctp-red">−R$ 245,80</span>
						</div>
						<div class="flex items-center justify-between border border-rule bg-paper p-3">
							<div class="flex items-center gap-3">
								<span class="size-3 bg-ctp-green"></span>
								<span class="font-mono text-sm">Salário</span>
							</div>
							<span class="font-mono text-sm text-ctp-green">+R$ 5.100,00</span>
						</div>
					</div>
				</TerminalWindow>
			</section>

			<section class="flex flex-col gap-8">
				<SectionHeading
					eyebrow="Como funciona"
					title="Quatro passos, e seus números fazem sentido."
				/>
				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
					{#each steps as step (step.number)}
						<div class="flex flex-col gap-2">
							<span class="font-mono text-3xl font-bold {step.color}">{step.number}</span>
							<h3 class="font-mono text-base font-semibold">{step.title}</h3>
							<p class="text-sm text-ink-soft">{step.body}</p>
						</div>
					{/each}
				</div>
			</section>

			<section class="flex flex-col gap-8">
				<SectionHeading
					eyebrow="Recursos"
					title="O que ele faz, e o que ele não faz com os seus dados."
				/>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each features as feature (feature.title)}
						<Card>
							<Card.Content class="flex flex-col gap-3">
								<div class="flex size-9 items-center justify-center rounded-lg {feature.bgClass}">
									<feature.icon class="size-4.5 {feature.textClass}" />
								</div>
								<h3 class="font-mono text-base font-semibold">{feature.title}</h3>
								<p class="text-sm text-ink-soft">{feature.body}</p>
							</Card.Content>
						</Card>
					{/each}
				</div>
			</section>

			<section class="flex flex-col gap-8">
				<SectionHeading
					eyebrow="No radar"
					title="O que vem depois."
					lead="Nada disso existe ainda. Tá aqui porque o roadmap é público — igual o código."
				/>
				<div class="flex flex-wrap gap-2">
					{#each roadmap as item (item.label)}
						<Badge variant="outline" class="gap-1.5 py-1 font-mono text-xs font-normal">
							<item.icon class="size-3.5" />
							{item.label}
						</Badge>
					{/each}
				</div>
			</section>

			<footer
				class="flex flex-col items-start gap-4 border-t border-rule pt-8 sm:flex-row sm:items-center sm:justify-between"
			>
				<div>
					<span class="font-mono text-sm font-semibold">tabelafin</span>
					<p class="text-xs text-ink-soft">AGPL-3.0 · SvelteKit + Cloudflare Workers</p>
				</div>
				<Button href={REPO_URL} target="_blank" rel="noreferrer" variant="ghost" size="sm">
					<CodeXmlIcon class="size-4" />
					Ver o código
				</Button>
			</footer>
		</div>
	</div>
</div>
