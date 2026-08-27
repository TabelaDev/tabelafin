import { describe, expect, it } from 'vitest';

import {
	isInternalTransfer,
	isSelfTransferByDescription,
	normalizeName
} from './internal-transfers';
import { pairMirrors } from './sync';

const day = (d: number) => new Date(`2026-08-${String(d).padStart(2, '0')}T12:00:00Z`);

describe('pairMirrors', () => {
	it('pairs the two legs of a transfer between accounts', () => {
		const paired = pairMirrors([
			{ id: 'out', accountId: 'A', amount: -500, date: day(1) },
			{ id: 'in', accountId: 'B', amount: 500, date: day(1) }
		]);
		expect(paired.sort()).toEqual(['in', 'out']);
	});

	// The regression that motivated the rewrite: the old cross-product marked
	// every compatible pair, so a real expense that happened to share an amount
	// with a real transfer vanished from the dashboard.
	it('never marks more rows than there are pairs', () => {
		const paired = pairMirrors([
			{ id: 'receita-real-A', accountId: 'A', amount: 50, date: day(1) },
			{ id: 'transf-saida-B', accountId: 'B', amount: -50, date: day(1) },
			{ id: 'gasto-real-C', accountId: 'C', amount: -50, date: day(2) }
		]);
		expect(paired).toHaveLength(2);
		expect(paired).not.toContain('gasto-real-C');
	});

	it('consumes each leg once when several transfers share an amount', () => {
		const paired = pairMirrors([
			{ id: 'in1', accountId: 'A', amount: 100, date: day(1) },
			{ id: 'out1', accountId: 'B', amount: -100, date: day(1) },
			{ id: 'in2', accountId: 'A', amount: 100, date: day(5) },
			{ id: 'out2', accountId: 'B', amount: -100, date: day(5) }
		]);
		expect(paired).toHaveLength(4);
		expect(new Set(paired).size).toBe(4);
	});

	it('does not pair legs more than two days apart', () => {
		const paired = pairMirrors([
			{ id: 'in', accountId: 'A', amount: 300, date: day(1) },
			{ id: 'out', accountId: 'B', amount: -300, date: day(9) }
		]);
		expect(paired).toEqual([]);
	});

	it('does not pair two legs of the same account', () => {
		const paired = pairMirrors([
			{ id: 'in', accountId: 'A', amount: 80, date: day(3) },
			{ id: 'out', accountId: 'A', amount: -80, date: day(3) }
		]);
		expect(paired).toEqual([]);
	});
});

// Money conservation: whatever the classifier decides, income minus spending
// minus internal movement has to equal the net change across the accounts. The
// two bugs this suite exists for both broke it by removing real rows.
describe('conservação de dinheiro', () => {
	const ledger = [
		{ id: 'salario', accountId: 'A', amount: 5000, date: day(1), category: null },
		{ id: 'mercado', accountId: 'A', amount: -300, date: day(2), category: null },
		{ id: 'transf-out', accountId: 'A', amount: -1000, date: day(3), category: null },
		{ id: 'transf-in', accountId: 'B', amount: 1000, date: day(3), category: null },
		{ id: 'uber', accountId: 'B', amount: -50, date: day(4), category: null },
		// Same amount as one leg of the transfer, but a real expense.
		{ id: 'farmacia', accountId: 'C', amount: -1000, date: day(4), category: null }
	];

	it('income - spending equals the net change once internals are excluded', () => {
		const internal = new Set(pairMirrors(ledger));

		const income = ledger
			.filter((t) => !internal.has(t.id) && t.amount > 0)
			.reduce((sum, t) => sum + t.amount, 0);
		const spending = ledger
			.filter((t) => !internal.has(t.id) && t.amount < 0)
			.reduce((sum, t) => sum + t.amount, 0);
		const net = ledger.reduce((sum, t) => sum + t.amount, 0);

		expect(income + spending).toBe(net);
		expect(income).toBe(5000);
		expect(spending).toBe(-1350);
		// The pharmacy charge shares an amount with the transfer and must survive.
		expect(internal.has('farmacia')).toBe(false);
	});
});

// The SQL filter reimplemented this rule and lost its null handling; the helper
// is the source of truth and has always been explicit about it.
describe('isInternalTransfer', () => {
	it('treats a missing category as not-yet-classified, not as internal', () => {
		expect(isInternalTransfer(null, 'Compra qualquer')).toBe(false);
		expect(isInternalTransfer(undefined, undefined)).toBe(false);
	});

	it('recognises the API categories and the Nubank invoice description', () => {
		expect(isInternalTransfer('Credit card payment')).toBe(true);
		expect(isInternalTransfer('Transfers', 'Pagamento de fatura')).toBe(true);
		expect(isInternalTransfer('Transfers', 'Dio 12/12')).toBe(false);
	});
});

// The name-based self-transfer rule — the gap Pluggy leaves when it labels a
// self Pix as generic "Transfers"/"Transfer - PIX" instead of "Same person
// transfer", which would otherwise count as income.
describe('isSelfTransferByDescription', () => {
	const FULL = 'Ian Patrick da Costa Soares';

	it('matches a Pix received from and sent to the user themselves', () => {
		expect(isSelfTransferByDescription('Pix recebido de Ian Patrick da Costa Soares', FULL)).toBe(
			true
		);
		expect(isSelfTransferByDescription('Pix enviado para Ian Patrick da Costa Soares', FULL)).toBe(
			true
		);
		expect(isSelfTransferByDescription('TED recebida de IAN PATRICK DA COSTA SOARES', FULL)).toBe(
			true
		);
		// The name can sit after a CPF on the "enviada" side.
		expect(
			isSelfTransferByDescription(
				'Transferência enviada|66.544.208 IAN PATRICK DA COSTA SOARES',
				FULL
			)
		).toBe(true);
	});

	it('ignores third parties and merchant charges', () => {
		expect(isSelfTransferByDescription('Pix recebido de Julia Correa M Nascimento', FULL)).toBe(
			false
		);
		expect(
			isSelfTransferByDescription(
				'Transferência Recebida|Claudia Keily Pinto Machado Nascimento',
				FULL
			)
		).toBe(false);
		expect(isSelfTransferByDescription('MP *NAVE', FULL)).toBe(false);
	});

	it('normalises accents and case', () => {
		expect(
			isSelfTransferByDescription('Pix recebido de José da Costa Soares', 'José da Costa Soares')
		).toBe(true);
	});

	it('is a no-op without a name set', () => {
		expect(isSelfTransferByDescription('Pix recebido de Ian Patrick da Costa Soares', '')).toBe(
			false
		);
		expect(isSelfTransferByDescription(null, FULL)).toBe(false);
	});
});

describe('normalizeName', () => {
	it('lowercases, strips accents and collapses whitespace', () => {
		expect(normalizeName('IAN PATRICK   DA COSTA SOARES')).toBe('ian patrick da costa soares');
		expect(normalizeName('José da Silva')).toBe('jose da silva');
	});
});
