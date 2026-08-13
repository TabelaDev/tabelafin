# Plano: importar planilha (Excel/CSV) com parse por IA

## 1. Objetivo

Deixar o usuário importar um export de extrato do banco em planilha (`.xlsx`,
`.xls`, `.csv`) e, com a própria IA dele (BYOK), descobrir o que cada coluna
significa e preencher as transações na plataforma — seguindo o fluxo e as
garantias do import de PDF que já existe.

## 2. Contexto — o que já existe (reaproveitar, não duplicar)

- **Fluxo de PDF** (`StatementImportModal.svelte` + `/api/statement-upload`):
  arquivo **nunca é persistido** — só a extração estruturada vai pro banco, com
  registro de auditoria em `statement_uploads`.
- **Extração por IA** (`src/lib/server/ai/extract.ts`): dispatcher fetch-based
  (Anthropic/OpenAI, sem SDK, roda em `workerd`), extração + categorização numa
  chamada só, e `parseExtraction` que tolera linha ruim descartando-a.
- **Categorização por texto** (`src/lib/server/ai/categorize.ts`): mesmo padrão
  fetch-based, mas **provider-agnóstico** — DeepSeek entra pelo mesmo caminho
  OpenAI-compatible (`categorizeWithOpenAiCompatible`).
- **Dedupe/supersede** (`transactions.ts`): `insertPdfTransaction` nasce já
  marcado como superseded se `findTransactionCoveringPdfRow` achar um
  equivalente (mesmo valor, ±3 dias) do sync. `source` em `transactions` é
  **texto livre** — dá pra usar um valor novo sem migração.
- **Categorias do usuário**: `getCategoriesByUser` (lista de nomes usada nos
  prompts e no schema do tool use).

## 3. Decisões de design

| #   | Decisão                                                                                                                                                       | Porquê                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Parse no browser** (SheetJS), só o grid vai pro servidor                                                                                                    | Mesmo ethos do `takeout-mbox`: nada além do dado estruturado sai da máquina; nenhum arquivo é enviado/persistido                                     |
| D2  | **A IA só infere o mapeamento de colunas** (não inventa transações)                                                                                           | Dados da planilha já são estruturados; usar IA pra criar linhas seria fonte de alucinação. A IA vê cabeçalhos + amostra e devolve _quem é quem_      |
| D3  | **Transações derivadas deterministicamente** do mapping                                                                                                       | Um mapper puro converte `grid + mapping → rows`, com a mesma tolerância do `parseExtraction`. Zero invento; a validação é testável sem DB nem IA     |
| D4  | **Preview + correção na UI** antes de inserir                                                                                                                 | Mapping de banco pra banco varia (Data/Descrição/Valor, Débito/Crédito separados, formato de data BR vs US). Usuário confere/corrige antes do insert |
| D5  | **Insert com `source='spreadsheet_upload'`** reusando o padrão do `insertPdfTransaction` (dedupe/supersede + `statement_uploads` como auditoria)              | **Sem migração de schema** — `source` é texto livre; reaproveita dedupe já testado                                                                   |
| D6  | **Categorias opcionais**: se a planilha tiver coluna de categoria usa; senão insere com `category = NULL` e deixa o categorizador em lote atual cuidar depois | Reusa o fluxo `getUncategorizedTransactions` existente; barato e honesto                                                                             |
| D7  | **Sem gate de `supportsDocuments`**                                                                                                                           | Não mandamos documento — mandamos texto (grid). Funciona com **qualquer** provider, inclusive DeepSeek (igual ao `categorize.ts`)                    |
| D8  | **Limites**: arquivo ≤ ~5 MB; grid com teto de células (~50 mil); payload de confirm com teto; linhas inválidas são **puladas** (contadas), não abortam       | Evita estourar token/request; mantém o upload resiliente                                                                                             |

## 4. Fluxo proposto

```
[usuário escolhe .xlsx/.xls/.csv]
        │
        ▼  (browser, SheetJS)
parseSpreadsheet(file) ──► { sheetName, headers, rows }   // grid de strings
        │
        ▼  POST /api/spreadsheet-import/map   (headers + primeiras ~20 linhas)
inferColumnMapping (IA: Anthropic/OpenAI/DeepSeek) ──► { mapping }
        │
        ▼  (browser, mapper puro compartilhado)
applyMapping(grid, mapping) ──► preview rows   // UI mostra mapping + amostra
        │                                          // usuário corrige via selects se preciso
        ▼  POST /api/spreadsheet-import/confirm  (grid + mapping)
server: applyMapping de novo (autoritativo) → valida → insert source='spreadsheet_upload'
        │         com dedupe/supersede → statement_uploads (processing→completed)
        ▼
toast: N importadas, X duplicadas, Y puladas
```

O servidor **re-aplica** o mapper no confirm (não confia no grid do cliente nem
na IA) — o mapper é compartilhado (`$lib/lib`), client e server usam o mesmo
código, mas o server é a fonte de verdade do insert.

## 5. Mudanças por camada

### Dependência

- **Decidido**: `xlsx` (SheetJS 0.18.5, npm) — uma lib lê `.xlsx`+`.xls`+`.csv`.
  Read-only simples é estável apesar da npm parada; o CVE de parse de arquivo
  malicioso é aceitável porque o usuário só lê os próprios arquivos (BYOK).
- Como é `*.spec.ts` ao lado do módulo e tudo roda em node/vitest, dá pra testar
  construindo o workbook em memória (`XLSX.utils.aoa_to_sheet`) sem fixture.

### Compartilhado (puro, client + server)

- **`src/lib/lib/spreadsheet-map.ts`** (novo)
  - Tipos: `Grid { headers: string[]; rows: string[][] }`, `ColumnMapping`
    (`dateColumn`, `descriptionColumn`, `amountColumn` **ou** `creditColumn` +
    `debitColumn`, `categoryColumn?`, `dateFormat: 'ISO'|'BR'|'US'`).
  - `applyMapping(grid, mapping) → ParsedRow[]` — parse de data (BR `DD/MM/AAAA`
    vs US `MM/DD/AAAA` vs ISO), valor (`-1.234,56`, `1.234,56`, `(1.234,56)`,
    `R$ 1.234,56`, sufixo `-`), sinal (coluna única negativa = gasto; débito –
    crédito quando separadas), e descrição.
  - `parseDateValue`, `parseAmountValue` exportados pra testar isolado.
  - `src/lib/lib/spreadsheet-map.spec.ts` (novo) — todos os casos acima.
- `src/lib/lib/spreadsheet-map.ts` importa só `$lib/lib/...` (nada de server).

### Client

- **`src/lib/client/spreadsheet.ts`** (novo): `parseSpreadsheet(file) → Grid`,
  usando SheetJS (`sheet_to_json` com `header:1` → strings, célula vazia → `''`).
  - `src/lib/client/spreadsheet.spec.ts` — workbook montado em memória.
- **`src/lib/components/SpreadsheetImportModal.svelte`** (novo): modal dedicado
  (o `StatementImportModal` é Takeout-específico; um arquivo único não precisa de
  fila/pill de progresso).
  - Steps: escolher arquivo → preview (mapping inferido em selects + amostra das
    linhas parseadas) → confirmar.
  - Estado local do modal (sem store — operação curta; o padrão de store/pill é
    pra fila longa do Takeout).
- **Botão de entrada**: na página de transações (`(app)/transactions/+page.svelte`)
  ao lado do gatilho do import de extrato existente.

### Server

- **`src/lib/server/ai/map-spreadsheet.ts`** (novo): `inferColumnMapping({ provider,
model, apiKey, headers, sample }) → Mapping`. Dispatcher fetch-based espelhando
  `categorize.ts` (Anthropic / OpenAI / DeepSeek via OpenAI-compatible). Tool use
  com schema que exige `dateColumn`/`descriptionColumn`/`dateFormat` e
  `anyOf [amountColumn | (creditColumn+debitColumn)]` + `categoryColumn?`.
  - `src/lib/server/ai/map-spreadsheet.spec.ts` — parse tolerante do output da IA
    (como `parseExtraction` em `extract.spec.ts`).
- **`src/routes/api/spreadsheet-import/map/+server.ts`** (novo): auth + AI creds →
  chama `inferColumnMapping` → devolve `{ mapping }`. Sem arquivo, só JSON.
- **`src/routes/api/spreadsheet-import/confirm/+server.ts`** (novo): auth → recebe
  `{ filename, sheetName, headers, rows, mapping }` → valida limites (células/payload)
  → `applyMapping` → descarta linha inválida → cria `statement_uploads`
  (processing) → insere via `insertSpreadsheetTransaction` → `updateStatementUpload`
  (completed, `transactionCount`) → devolve `{ count, duplicates, skipped }`.
- **`src/lib/server/db/transactions.ts`**: adicionar `insertSpreadsheetTransaction`
  espelhando `insertPdfTransaction` (mesmo `findTransactionCoveringPdfRow`,
  `categorySource = 'ai'` quando categoria veio da coluna, `source =
'spreadsheet_upload'`).
- **Reusar**: `statement-uploads.ts`, `crypto.ts` (decrypt da chave),
  `getCategoriesByUser`, dedupe/supersede.

### Sem mudanças de schema

`transactions.source` e `statement_uploads` já suportam o fluxo. Só se quisermos
persistir o mapping por upload (fase 2) precisaria de coluna — fora do escopo.

## 6. Testes

- `spreadsheet-map.spec.ts` (puro): datas BR/US/ISO, valores `R$`/milhar/parêntese/
  sufixo, débito/crédito separadas, coluna única com sinal, categoria opcional,
  linhas inválidas puladas.
- `map-spreadsheet.spec.ts`: tolerância do output da IA (mapping ausente/malformado
  → erro claro; campos sobrando → ignorados).
- `spreadsheet.spec.ts` (client): workbook em memória → grid correto (headers +
  strings, células vazias).
- Rotas: a lógica crítica é pura (mapper) — coberta por spec; e2e opcional depois.
- Smoke manual com exports reais (Nubank, XP): colunas típicas, data BR, valor
  com separador de milhar.

## 7. Milestones / ordem

- **M0**: dep + `spreadsheet-map.ts` + spec.
- **M1**: `map-spreadsheet.ts` + spec (provider dispatch incl. DeepSeek).
- **M2**: endpoints `map` + `confirm` + `insertSpreadsheetTransaction`.
- **M3**: `client/spreadsheet.ts` + spec.
- **M4**: `SpreadsheetImportModal` + botão na página de transações.
- **M5**: smoke com exports reais; categorização das linhas `category = NULL` via
  fluxo existente; docs (README/AGENTS se necessário).

## 8. Fora de escopo (v1)

- Lembrar o mapeamento por banco (fase 2) / persistir mapping por upload.
- Edição linha a linha no preview.
- Múltiplas abas da planilha.
- Google Sheets / OFX.
- Importar planilha _sem_ IA (mapping manual puro) — a IA é o atalho; se não
  houver credencial, mensagem clara pra configurar.

## 9. Decisões resolvidas e abertas

Resolvidas: lib **SheetJS `xlsx`** (`.xlsx/.xls/.csv`); categorias **NULL → categorizador**
em lote (usa a coluna se houver, item D6).

Abertas (defaults assumidos até você falar o contrário):

1. **UI**: modal dedicado `SpreadsheetImportModal.svelte` com botão na página de
   transações (default). Alternativa: estender o `StatementImportModal` com modo planilha.
2. **Source**: `'spreadsheet_upload'` (default).
