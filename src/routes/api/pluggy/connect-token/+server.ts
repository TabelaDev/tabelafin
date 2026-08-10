import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Endpoint obsoleto — o widget do Pluggy Connect não é mais usado.
// Mantido como stub pra não quebrar clients existentes.
export const POST: RequestHandler = async () => {
	return json(
		{
			error:
				'Este endpoint foi descontinuado. O TabelaFin agora usa a API do Meu Pluggy diretamente.'
		},
		{ status: 410 }
	);
};
