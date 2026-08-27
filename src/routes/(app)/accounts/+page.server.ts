import { AccountType } from '$lib/enums/account-type';
import { ToastType } from '$lib/enums/toast-type';
import { getDb } from '$lib/server/db';
import {
	createManualAccount,
	deleteAccount,
	getAccountsByUser,
	isManualAccount,
	updateAccountBalance
} from '$lib/server/db/accounts';
import { requireLogin } from '$lib/server/require-login';
import { signedBalance, sumSignedBalance } from '$lib/utils/accounts';
import { parseCents } from '$lib/utils/money';

import { fail } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.userId) requireLogin();

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	const userAccounts = await getAccountsByUser(db, userId);

	const checking = userAccounts
		.filter((a) => a.type === AccountType.Checking)
		.reduce((sum, a) => sum + a.cachedBalance, 0);
	const investment = userAccounts
		.filter((a) => a.type === AccountType.Investment)
		.reduce((sum, a) => sum + a.cachedBalance, 0);
	const credit = userAccounts
		.filter((a) => a.type === AccountType.CreditCard)
		.reduce((sum, a) => sum + a.cachedBalance, 0);

	return {
		// Sorted on the signed axis: by raw balance the card climbs to the top as
		// if its open invoice were the user's largest account.
		accounts: [...userAccounts]
			.sort((a, b) => signedBalance(b) - signedBalance(a))
			// `manual` drives which rows offer edit/delete: a Pluggy-owned balance is
			// overwritten by the next sync, so letting someone edit it would be a
			// change that silently reverts.
			.map((a) => ({ ...a, manual: isManualAccount(a) })),
		summary: {
			// `credit` stays the debt as a magnitude — its own card already renders
			// the "-" and the "fatura em aberto" label. Only the total sums signed.
			total: sumSignedBalance(userAccounts),
			checking: checking,
			investment: investment,
			credit: credit
		}
	};
};

const ACCOUNT_TYPES = Object.values(AccountType);

export const actions: Actions = {
	create: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const type = String(form.get('type') ?? '');
		const balance = parseCents(form.get('balance'));

		if (!name) return fail(400, { error: 'Dê um nome pra conta.' });
		if (!ACCOUNT_TYPES.includes(type as AccountType)) {
			return fail(400, { error: 'Escolha um tipo de conta.' });
		}
		if (balance === null) return fail(400, { error: 'Informe um saldo válido.' });

		const db = getDb(platform!.env.DB);
		await createManualAccount(db, {
			userId: locals.userId,
			name,
			type: type as AccountType,
			balance
		});
		setFlash({ type: ToastType.success, message: `Conta "${name}" criada.` }, event);
		return { success: true };
	},

	updateBalance: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();

		const form = await request.formData();
		const accountId = String(form.get('accountId') ?? '');
		const balance = parseCents(form.get('balance'));
		if (!accountId) return fail(400, { error: 'Conta inválida.' });
		if (balance === null) return fail(400, { error: 'Informe um saldo válido.' });

		const db = getDb(platform!.env.DB);
		// Ownership is enforced in the WHERE clause, so a forged id updates nothing
		// rather than someone else's row.
		await updateAccountBalance(db, locals.userId, accountId, balance);
		setFlash({ type: ToastType.success, message: 'Saldo atualizado.' }, event);
		return { success: true };
	},

	delete: async (event) => {
		const { request, locals, platform } = event;
		if (!locals.userId) requireLogin();

		const form = await request.formData();
		const accountId = String(form.get('accountId') ?? '');
		if (!accountId) return fail(400, { error: 'Conta inválida.' });

		const db = getDb(platform!.env.DB);
		await deleteAccount(db, locals.userId, accountId);
		setFlash(
			{
				type: ToastType.success,
				message: 'Conta excluída — as transações continuam, sem conta vinculada.'
			},
			event
		);
		return { success: true };
	}
};
