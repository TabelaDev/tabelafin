import { unauthorizedJson } from '$lib/server/api-auth';
import { getDb } from '$lib/server/db';
import { financeAccounts, transactions } from '$lib/server/db/schema';
import { exportUserData } from '$lib/server/db/user-data';

import { eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

import type { RequestHandler } from './$types';

interface ExportRequest {
	format: 'json' | 'csv' | 'xlsx';
	tables: string[];
}

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.userId) return unauthorizedJson();

	const body = (await request.json()) as ExportRequest;
	const { format, tables } = body;

	if (!format || !Array.isArray(tables) || tables.length === 0) {
		return new Response(JSON.stringify({ error: 'Parâmetros inválidos.' }), {
			status: 400,
			headers: { 'content-type': 'application/json' }
		});
	}

	const db = getDb(platform!.env.DB);
	const userId = locals.userId;

	if (format === 'json') {
		const allData = await exportUserData(db, userId);
		const filtered: Record<string, unknown> = {
			exportedAt: allData.exportedAt,
			format: allData.format
		};

		if (tables.includes('transactions')) filtered.transactions = allData.transactions;
		if (tables.includes('accounts')) filtered.accounts = allData.accounts;
		if (tables.includes('categories')) filtered.categories = allData.categories;
		if (tables.includes('rules')) filtered.categorizationRules = allData.categorizationRules;
		if (tables.includes('tags')) filtered.tags = allData.tags;
		if (tables.includes('tagRules')) filtered.tagRules = allData.tagRules;
		if (tables.includes('recurring')) filtered.recurringExpenses = allData.recurringExpenses;
		if (tables.includes('reports')) filtered.monthlyReports = allData.monthlyReports;
		if (tables.includes('uploads')) filtered.statementUploads = allData.statementUploads;
		if (tables.includes('chat')) filtered.chat = allData.chat;
		if (tables.includes('prompts')) filtered.aiPrompts = allData.aiPrompts;

		const stamp = new Date().toISOString().slice(0, 10);
		return new Response(JSON.stringify(filtered, null, 2), {
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'content-disposition': `attachment; filename="tabelhafin-${stamp}.json"`,
				'cache-control': 'no-store'
			}
		});
	}

	// CSV and XLSX only support transactions
	const txs = await db
		.select({
			id: transactions.id,
			date: transactions.date,
			description: transactions.description,
			amount: transactions.amount,
			source: transactions.source,
			category: transactions.category,
			accountName: financeAccounts.name,
			accountType: financeAccounts.type
		})
		.from(transactions)
		.leftJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id))
		.where(eq(transactions.userId, userId));

	const rows = txs.map((t) => ({
		ID: t.id,
		Data: t.date,
		Descrição: t.description,
		Valor: t.amount,
		Fonte: t.source,
		Categoria: t.category ?? '',
		Conta: t.accountName ?? '',
		'Tipo conta': t.accountType ?? ''
	}));

	const stamp = new Date().toISOString().slice(0, 10);

	if (format === 'csv') {
		const headers = Object.keys(rows[0] ?? {});
		const csvRows = [headers.join(',')];

		for (const row of rows) {
			const values = headers.map((h) => {
				const val = String((row as Record<string, unknown>)[h] ?? '');
				// Escape quotes and wrap in quotes if contains comma/quote/newline
				if (val.includes(',') || val.includes('"') || val.includes('\n')) {
					return `"${val.replace(/"/g, '""')}"`;
				}
				return val;
			});
			csvRows.push(values.join(','));
		}

		const csv = csvRows.join('\n');
		return new Response(csv, {
			headers: {
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': `attachment; filename="tabelhafin-transacoes-${stamp}.csv"`,
				'cache-control': 'no-store'
			}
		});
	}

	// XLSX
	const ws = XLSX.utils.json_to_sheet(rows);

	// Style: set column widths
	const colWidths = [
		{ wch: 36 }, // ID
		{ wch: 12 }, // Data
		{ wch: 40 }, // Descrição
		{ wch: 15 }, // Valor
		{ wch: 15 }, // Fonte
		{ wch: 20 }, // Categoria
		{ wch: 25 }, // Conta
		{ wch: 12 } // Tipo conta
	];
	ws['!cols'] = colWidths;

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Transações');

	const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

	return new Response(xlsxBuffer, {
		headers: {
			'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'content-disposition': `attachment; filename="tabelhafin-transacoes-${stamp}.xlsx"`,
			'cache-control': 'no-store'
		}
	});
};
