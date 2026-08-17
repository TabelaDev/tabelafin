<script lang="ts">
	import { resolve } from '$app/paths';

	const UPDATED_AT = '16 de agosto de 2026';
	const CONTACT = 'ianptkcs@gmail.com';
</script>

<svelte:head>
	<title>Termos de Uso — TabelaFin</title>
	<meta name="description" content="Condições de uso do TabelaFin." />
</svelte:head>

<article class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
	<header class="flex flex-col gap-2">
		<h1 class="font-mono text-2xl font-bold">Termos de Uso</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span> Última atualização: {UPDATED_AT}
		</p>
	</header>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">O que é o TabelaFin</h2>
		<p class="text-sm leading-relaxed">
			O TabelaFin é uma ferramenta de organização de finanças pessoais. Ele lê dados das suas contas
			(via Open Finance, upload de extrato ou lançamento manual), organiza em categorias e monta
			visualizações e relatórios. Ao criar uma conta, você concorda com estes termos e com a
			<a href={resolve('/privacidade')} class="text-accent hover:underline"
				>Política de Privacidade</a
			>.
		</p>
	</section>

	<section class="flex flex-col gap-3 border border-rule p-4">
		<h2 class="font-mono text-lg font-semibold">O que o TabelaFin não é</h2>
		<p class="text-sm leading-relaxed">
			<strong>Não é uma instituição financeira.</strong> O TabelaFin não é banco, corretora, meio de pagamento
			nem instituição autorizada pelo Banco Central. Ele não movimenta, guarda nem transfere dinheiro
			— apenas lê e exibe informações. O acesso aos seus dados bancários é de leitura, através da sua
			própria conexão no Meu Pluggy.
		</p>
		<p class="text-sm leading-relaxed">
			<strong>Não é consultoria ou recomendação de investimento.</strong> Números, gráficos, relatórios
			e as respostas do chat de IA são organização e resumo dos seus próprios dados, não análise profissional.
			O TabelaFin não é credenciado pela CVM e nada aqui constitui recomendação de compra, venda ou manutenção
			de qualquer ativo. Decisões financeiras são suas; para orientação profissional, procure um assessor
			certificado.
		</p>
		<p class="text-sm leading-relaxed">
			<strong>Não é fonte de verdade contábil ou fiscal.</strong> Categorização automática pode errar,
			sincronizações podem falhar ou atrasar, e a IA pode produzir resultados incorretos. Confira sempre
			contra o extrato oficial do seu banco antes de usar qualquer número para declaração de imposto,
			prestação de contas ou decisão relevante.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Sua conta</h2>
		<ul class="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
			<li>Você precisa ter 18 anos ou mais e fornecer um e-mail válido.</li>
			<li>
				A senha e as credenciais que você cadastra são de sua responsabilidade. Avise em
				<a href="mailto:{CONTACT}" class="text-accent hover:underline">{CONTACT}</a> se suspeitar de acesso
				indevido.
			</li>
			<li>Uma conta é de uso pessoal e individual — não compartilhe o acesso.</li>
			<li>
				Você pode excluir sua conta a qualquer momento em
				<a href={resolve('/profile')} class="text-accent hover:underline">Perfil</a>, sem custo e
				sem precisar pedir.
			</li>
		</ul>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Credenciais de terceiros (BYOK)</h2>
		<p class="text-sm leading-relaxed">
			O TabelaFin funciona com as suas credenciais: sua chave de API de IA e seu token do Meu
			Pluggy. Isso significa que
			<strong>você paga diretamente ao provedor de IA</strong> pelo que consumir — o TabelaFin não revende
			nem intermedeia esse custo, e não tem como reembolsá-lo. O uso do Meu Pluggy e do seu provedor de
			IA está sujeito aos termos de cada um deles.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Disponibilidade e limitação de responsabilidade</h2>
		<p class="text-sm leading-relaxed">
			O serviço é oferecido gratuitamente, <strong>no estado em que se encontra</strong>, sem
			garantia de disponibilidade, exatidão ou adequação a qualquer finalidade específica. Pode
			haver indisponibilidade, perda de dados, falha de sincronização ou descontinuação do serviço,
			com aviso prévio razoável quando possível.
		</p>
		<p class="text-sm leading-relaxed">
			Na máxima extensão permitida pela legislação brasileira, o controlador não responde por danos
			indiretos, lucros cessantes ou perdas decorrentes de decisões tomadas com base nas informações
			exibidas pelo TabelaFin. Isso não afasta os direitos que o Código de Defesa do Consumidor e a
			LGPD garantem a você.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Uso aceitável</h2>
		<p class="text-sm leading-relaxed">
			Não use o TabelaFin para acessar dados de terceiros sem autorização, para atividade ilícita,
			nem para sobrecarregar deliberadamente a infraestrutura. Contas que violarem isso podem ser
			suspensas ou removidas.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Licença do código</h2>
		<p class="text-sm leading-relaxed">
			O código é aberto sob AGPL-3.0 e está no
			<a
				href="https://github.com/TabelaDev/tabelafin"
				rel="noreferrer"
				class="text-accent hover:underline">GitHub</a
			>. A licença cobre o software; estes termos cobrem o uso desta instância hospedada.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Foro e contato</h2>
		<p class="text-sm leading-relaxed">
			Estes termos são regidos pela lei brasileira. Dúvidas, reclamações e pedidos:
			<a href="mailto:{CONTACT}" class="text-accent hover:underline">{CONTACT}</a>.
		</p>
	</section>
</article>
