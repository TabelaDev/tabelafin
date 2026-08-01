<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
</script>

<svelte:head>
	<title>TabelaFin</title>
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 p-6">
	<Card class="w-full">
		<CardHeader>
			<CardTitle>TabelaFin</CardTitle>
			<CardDescription>
				Finanças pessoais sem lançamento manual — sync automático via Open Finance e categorização
				com IA.
			</CardDescription>
		</CardHeader>
		<CardContent class="text-sm text-muted-foreground">
			Onboarding ainda não implementado.
		</CardContent>
	</Card>
</main>
