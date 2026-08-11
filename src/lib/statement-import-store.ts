// State for the bulk statement import: which modal step is open, and the queue
// of PDFs being uploaded.
//
// It lives in a module (like onboarding-store) rather than inside the modal so
// the queue survives closing the modal and moving between pages — the whole
// point of the progress pill. What it deliberately does NOT survive is a reload:
// persisting an in-flight queue would mean re-uploading a file that may already
// have landed. Resume is handled instead by asking the server which filenames
// completed, which is the only source that cannot lie.

import { writable } from 'svelte/store';
import type { TakeoutAttachment } from '$lib/takeout-mbox';

export type ImportStep = 'instructions' | 'upload' | 'review';

export type QueueItemStatus = 'pending' | 'uploading' | 'done' | 'failed';

export interface QueueItem {
	filename: string;
	monthKey: string;
	status: QueueItemStatus;
	/** Transactions actually imported (duplicates excluded). */
	imported: number;
	/** Rows recognised as already covered by the sync. */
	duplicates: number;
	error?: string;
}

export interface ImportState {
	open: boolean;
	step: ImportStep;
	/** Parsed attachments, kept out of the queue so bytes are not duplicated. */
	attachments: TakeoutAttachment[];
	/** Filenames ticked in the review step. */
	selected: Set<string>;
	/** Filenames the server reports as already imported. */
	alreadyImported: Set<string>;
	queue: QueueItem[];
	running: boolean;
	/** Index of the item being uploaded, for the pill. */
	currentIndex: number;
}

export const initialImportState: ImportState = {
	open: false,
	step: 'instructions',
	attachments: [],
	selected: new Set(),
	alreadyImported: new Set(),
	queue: [],
	running: false,
	currentIndex: 0
};

export const statementImport = writable<ImportState>({ ...initialImportState });

export function openStatementImport() {
	statementImport.update((s) => ({
		...s,
		open: true,
		step: s.queue.length ? s.step : 'instructions'
	}));
}

export function closeStatementImport() {
	statementImport.update((s) => ({ ...s, open: false }));
}

/** Clears everything except a queue that is still running. */
export function resetStatementImport() {
	statementImport.update((s) =>
		s.running
			? { ...s, open: false }
			: { ...initialImportState, selected: new Set(), alreadyImported: new Set() }
	);
}

export function setStep(step: ImportStep) {
	statementImport.update((s) => ({ ...s, step }));
}

export function setAttachments(attachments: TakeoutAttachment[], alreadyImported: Set<string>) {
	statementImport.update((s) => ({
		...s,
		attachments,
		alreadyImported,
		// Anything already imported starts unticked: re-running it would spend an
		// AI extraction to produce rows the dedupe would then hide anyway.
		selected: new Set(
			attachments.filter((a) => !alreadyImported.has(a.filename)).map((a) => a.filename)
		),
		step: 'review'
	}));
}

export function toggleSelected(filename: string) {
	statementImport.update((s) => {
		const selected = new Set(s.selected);
		if (selected.has(filename)) selected.delete(filename);
		else selected.add(filename);
		return { ...s, selected };
	});
}

export function setAllSelected(filenames: string[], value: boolean) {
	statementImport.update((s) => {
		const selected = new Set(s.selected);
		for (const f of filenames) {
			if (value) selected.add(f);
			else selected.delete(f);
		}
		return { ...s, selected };
	});
}

export function startQueue(items: QueueItem[]) {
	statementImport.update((s) => ({ ...s, queue: items, running: true, currentIndex: 0 }));
}

export function markItem(index: number, patch: Partial<QueueItem>) {
	statementImport.update((s) => {
		const queue = s.queue.map((item, i) => (i === index ? { ...item, ...patch } : item));
		return { ...s, queue };
	});
}

export function setCurrentIndex(index: number) {
	statementImport.update((s) => ({ ...s, currentIndex: index }));
}

export function finishQueue() {
	statementImport.update((s) => ({ ...s, running: false }));
}
