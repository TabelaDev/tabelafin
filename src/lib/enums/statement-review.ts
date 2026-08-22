export enum StatementReviewStatus {
	Pending = 'pending',
	Ready = 'ready',
	Applied = 'applied',
	Cancelled = 'cancelled'
}

export enum StatementSource {
	TakeoutZip = 'takeout_zip',
	SinglePdf = 'single_pdf',
	Csv = 'csv'
}

export enum StatementBank {
	Nubank = 'nubank',
	Itau = 'itau',
	Inter = 'inter',
	Generic = 'generic',
	Auto = 'auto'
}
