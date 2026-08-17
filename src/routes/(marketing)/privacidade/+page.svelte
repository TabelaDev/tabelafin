<script lang="ts">
	import { resolve } from '$app/paths';

	// Every claim here is checked against the code, not aspirational: the
	// encryption paragraph matches server/crypto.ts, the "we do not persist the
	// PDF" claim matches api/statement-upload, and the third-party list matches
	// the only outbound hosts in server/http.ts callers. If one of those changes,
	// this page is part of the change.
	const UPDATED_AT = '16 de agosto de 2026';
	const CONTACT = 'ianptkcs@gmail.com';
</script>

<svelte:head>
	<title>Política de Privacidade — TabelaFin</title>
	<meta
		name="description"
		content="Como o TabelaFin coleta, usa, armazena e compartilha seus dados financeiros."
	/>
</svelte:head>

<article class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
	<header class="flex flex-col gap-2">
		<h1 class="font-mono text-2xl font-bold">Política de Privacidade</h1>
		<p class="font-mono text-sm text-ink-soft">
			<span class="text-ink-faint">//</span> Última atualização: {UPDATED_AT}
		</p>
	</header>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Quem é o controlador</h2>
		<p class="text-sm leading-relaxed">
			O TabelaFin é mantido por Ian Patrick da Costa Soares, pessoa física, que atua como
			controlador dos dados pessoais tratados no serviço, nos termos da Lei nº 13.709/2018 (LGPD).
			Contato para qualquer assunto relacionado a dados:
			<a href="mailto:{CONTACT}" class="text-accent hover:underline">{CONTACT}</a>.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Onde seus dados ficam</h2>
		<p class="text-sm leading-relaxed">
			O TabelaFin é um <strong>serviço hospedado</strong>. Seus dados ficam em um banco Cloudflare
			D1 na conta Cloudflare do controlador — não no seu computador e não em infraestrutura sua. Se
			você prefere que seus dados financeiros não saiam da sua própria máquina, este serviço não é
			adequado para você; o código é aberto e pode ser hospedado por você mesmo.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">O que é coletado</h2>
		<ul class="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
			<li>
				<strong>Cadastro:</strong> nome, e-mail e senha (armazenada com hash, nunca em texto).
			</li>
			<li>
				<strong>Dados financeiros:</strong> contas, saldos, transações (data, descrição, valor), categorias,
				tags, recorrências e investimentos — vindos do Open Finance via Meu Pluggy, de upload de extrato
				ou de lançamento manual.
			</li>
			<li>
				<strong>Credenciais de terceiros:</strong> sua chave de API de IA e seu token do Meu Pluggy.
			</li>
			<li>
				<strong>Conversas com a IA:</strong> as mensagens que você troca no chat e os relatórios mensais
				gerados.
			</li>
		</ul>
		<p class="text-sm leading-relaxed">
			Não há analytics, rastreadores, cookies de publicidade ou perfilamento. Os únicos cookies são
			os de sessão, necessários para manter você autenticado.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Como suas credenciais são protegidas</h2>
		<p class="text-sm leading-relaxed">
			A chave de IA e o token do Meu Pluggy são criptografados antes de ir para o banco, com
			AES-256-GCM e uma chave derivada por HKDF que inclui seu identificador de usuário e a
			finalidade da credencial. Na prática: uma credencial cifrada de um usuário não pode ser
			decifrada no contexto de outro, nem reaproveitada para outra finalidade. Elas nunca aparecem
			em logs nem são devolvidas pela API depois de salvas.
		</p>
		<p class="text-sm leading-relaxed">
			<strong>O resto dos dados não é criptografado em nível de aplicação.</strong> Transações, descrições,
			saldos e mensagens de chat ficam legíveis no banco para quem tiver acesso administrativo à infraestrutura
			— na prática, o controlador. Há criptografia em repouso e em trânsito pela Cloudflare, mas isso
			é diferente de criptografia ponta a ponta, que este serviço não oferece.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Com quem seus dados são compartilhados</h2>
		<p class="text-sm leading-relaxed">
			Seus dados não são vendidos, alugados nem compartilhados para fins comerciais. Eles transitam
			apenas pelos serviços necessários para o app funcionar:
		</p>
		<ul class="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
			<li>
				<strong>Cloudflare</strong> — hospedagem, banco de dados e rede.
			</li>
			<li>
				<strong>Meu Pluggy (Pluggy)</strong> — origem dos dados de Open Finance, usando o token que você
				mesmo forneceu.
			</li>
			<li>
				<strong>O provedor de IA que você escolheu</strong> (Anthropic, OpenAI ou DeepSeek) — recebe as
				descrições e valores das transações a categorizar, o conteúdo do PDF que você enviar e as mensagens
				do chat. Quem define o provedor e paga por ele é você; o tratamento desses dados passa a seguir
				também a política de privacidade dele.
			</li>
			<li>
				<strong>Brevo</strong> — envio dos e-mails de confirmação de conta e redefinição de senha (recebe
				apenas o seu endereço de e-mail).
			</li>
		</ul>
		<p class="text-sm leading-relaxed">
			Se a IA estiver desativada nas suas configurações, nenhum dado seu é enviado a provedor de IA
			algum.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Upload de extrato em PDF</h2>
		<p class="text-sm leading-relaxed">
			O arquivo enviado é repassado ao provedor de IA que você escolheu para extração e
			<strong>não é armazenado</strong>: o TabelaFin guarda apenas as transações extraídas dele. O
			arquivo em si é descartado ao fim do processamento.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Por quanto tempo</h2>
		<p class="text-sm leading-relaxed">
			Seus dados são mantidos enquanto sua conta existir. Ao excluir a conta, tudo que é seu —
			contas, transações, categorias, tags, recorrências, relatórios, conversas e credenciais — é
			apagado do banco em cascata, de forma imediata e irreversível. Cópias residuais podem
			persistir por até 30 dias em backups da infraestrutura antes de serem sobrescritas.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Seus direitos</h2>
		<p class="text-sm leading-relaxed">
			A LGPD (art. 18) garante a você o direito de acessar, corrigir, portar e eliminar seus dados,
			além de revogar consentimento. Dois desses direitos estão disponíveis direto no app, sem
			precisar pedir:
		</p>
		<ul class="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
			<li>
				<strong>Portabilidade e acesso:</strong> em
				<a href={resolve('/profile')} class="text-accent hover:underline">Perfil</a>, você baixa
				todos os seus dados em JSON.
			</li>
			<li>
				<strong>Eliminação:</strong> em
				<a href={resolve('/profile')} class="text-accent hover:underline">Perfil</a>, você exclui a
				conta e tudo que está ligado a ela.
			</li>
			<li>
				<strong>Correção:</strong> os dados são editáveis nas próprias telas do app.
			</li>
		</ul>
		<p class="text-sm leading-relaxed">
			Para qualquer outro pedido, escreva para
			<a href="mailto:{CONTACT}" class="text-accent hover:underline">{CONTACT}</a>. O prazo de
			resposta é de até 15 dias.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Incidentes de segurança</h2>
		<p class="text-sm leading-relaxed">
			Em caso de incidente que possa acarretar risco relevante aos seus dados, você será comunicado
			pelo e-mail cadastrado, junto com a ANPD, conforme o art. 48 da LGPD.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-mono text-lg font-semibold">Mudanças nesta política</h2>
		<p class="text-sm leading-relaxed">
			Alterações são publicadas nesta página com nova data de atualização. Mudanças materiais no
			tratamento dos dados são avisadas por e-mail antes de entrarem em vigor. O histórico completo
			de alterações fica público no
			<a
				href="https://github.com/TabelaDev/tabelafin"
				rel="noreferrer"
				class="text-accent hover:underline">repositório</a
			>.
		</p>
	</section>
</article>
