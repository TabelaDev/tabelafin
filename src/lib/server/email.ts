// Transactional e-mail through Brevo's REST API.
//
// fetch-based, no SDK — same constraint as the AI and Pluggy clients: the
// vendor SDKs assume Node built-ins that `workerd` does not provide.
//
// Brevo rather than Resend/Postmark because its pricing is materially better
// for Brazil, which is the whole user base here.
//
// Sending is *best-effort by design*. A verification e-mail that fails to send
// must not roll back the account that was just created, and a password-reset
// request must not tell an unauthenticated caller whether the address exists.
// So the send functions log and return a boolean rather than throwing, and
// their callers ignore the result.
import { fetchWithRetry } from '$lib/server/http';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const FROM_NAME = 'TAbelhaFin';

// The From address comes from the environment (`EMAIL_FROM`) rather than being
// hardcoded, because **Brevo will not deliver from an unverified sender** — and
// what can be verified changes over time.
//
// This started as `nao-responda@tabelafin.com.br`, which nobody owns: every
// send would have failed with a 400, and since sending is best-effort the user
// would have seen "enviamos um link" for a mail that never existed. Brevo also
// accepts a verified *single address*, not just a domain, so a personal address
// works today and the var flips to a domain address the day there is one —
// without touching this file.
interface SendEmailInput {
	to: string;
	subject: string;
	// Plain text only: these messages are three lines and a link, and a text
	// body avoids both the HTML-escaping footgun and the spam-score penalty of
	// an HTML mail with almost no content.
	text: string;
	apiKey: string;
	from: string;
}

async function sendEmail({ to, subject, text, apiKey, from }: SendEmailInput): Promise<boolean> {
	try {
		const res = await fetchWithRetry(BREVO_API_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json',
				'api-key': apiKey
			},
			body: JSON.stringify({
				sender: { email: from, name: FROM_NAME },
				to: [{ email: to }],
				subject,
				textContent: text
			})
		});

		if (!res.ok) {
			// The body carries Brevo's own reason (unverified sender, bad key,
			// quota) — worth logging, and it contains no user secret.
			console.error('[email] Brevo recusou o envio', {
				status: res.status,
				body: await res.text()
			});
			return false;
		}
		return true;
	} catch (err) {
		console.error('[email] falha ao enviar', {
			error: err instanceof Error ? err.message : String(err)
		});
		return false;
	}
}

export async function sendVerificationEmail(
	apiKey: string,
	from: string,
	to: string,
	verificationUrl: string
): Promise<boolean> {
	return sendEmail({
		to,
		apiKey,
		from,
		subject: 'Confirme seu e-mail — TAbelhaFin',
		text: [
			'Confirme seu endereço de e-mail para ativar sua conta no TAbelhaFin.',
			'',
			verificationUrl,
			'',
			'Se você não criou essa conta, ignore esta mensagem — nada será ativado.'
		].join('\n')
	});
}

export async function sendPasswordResetEmail(
	apiKey: string,
	from: string,
	to: string,
	resetUrl: string
): Promise<boolean> {
	return sendEmail({
		to,
		apiKey,
		from,
		subject: 'Redefinir sua senha — TAbelhaFin',
		text: [
			'Recebemos um pedido para redefinir a senha da sua conta no TAbelhaFin.',
			'',
			resetUrl,
			'',
			'O link expira em 1 hora.',
			'Se não foi você, ignore esta mensagem — sua senha continua a mesma.'
		].join('\n')
	});
}
