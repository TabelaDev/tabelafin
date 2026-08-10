<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import { toast } from '@tabeladev/tabelawebui';

	const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW();

	let offlineToastShown = false;
	let refreshToastShown = false;

	$effect(() => {
		if ($offlineReady && !offlineToastShown) {
			offlineToastShown = true;
			toast.success('TabelaFin está pronto para uso offline.');
		}
	});

	$effect(() => {
		if ($needRefresh && !refreshToastShown) {
			refreshToastShown = true;
			toast('Nova versão do TabelaFin disponível.', {
				duration: Number.POSITIVE_INFINITY,
				action: {
					label: 'Atualizar',
					onClick: () => updateServiceWorker(true)
				}
			});
		}
	});
</script>
