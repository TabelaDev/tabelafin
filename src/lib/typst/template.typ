// Template de relatório mensal do TabelaFin
// Compilado client-side via typst.ts (WASM)

#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
  header: context {
    if counter(page).get().first() > 1 [
      #set text(size: 8pt, fill: rgb("#888"))
      TabelaFin — Relatório Mensal
      #h(1fr)
      #datetime.today().display("[day]/[month]/[year]")
    ]
  },
  footer: [
    #set text(size: 8pt, fill: rgb("#888"))
    #h(1fr)
    #counter(page).display("1 / 1", both: true)
    #h(1fr)
  ]
)

#set text(font: "JetBrains Mono", size: 10pt, fill: rgb("#1a1a2e"))
#set par(justify: true, leading: 0.65em)

// --- CAPA ---
#align(center + horizon)[
  #text(size: 28pt, weight: "bold", fill: rgb("#6c5ce7"))[TabelaFin]
  #v(0.5cm)
  #text(size: 18pt)[Relatório Financeiro Mensal]
  #v(0.3cm)
  #text(size: 14pt, fill: rgb("#666"))[#month-year]
  #v(1cm)
  #text(size: 11pt, fill: rgb("#888"))[Gerado em #generation-date]
]

#pagebreak()

// --- RESUMO EXECUTIVO ---
= Resumo Executivo

#summary

#v(0.5cm)

// --- INDICADORES ---
= Indicadores do Mês

#{
  table(
    columns: (1fr, auto),
    align: (left, right),
    stroke: rgb("#e0e0e0"),
    inset: 10pt,
    table.header(
      text(weight: "bold")[Indicador],
      text(weight: "bold")[Valor]
    ),
    [Renda Total], text(fill: rgb("#00b894"))[+ #income],
    [Gastos Totais], text(fill: rgb("#d63031"))[- #expense],
    [Saldo do Mês], text(weight: "bold")[#balance],
    [Saldo em Investimentos], [#investment-balance],
  )
}

#v(0.5cm)

// --- GASTOS POR CATEGORIA ---
= Gastos por Categoria

#{
  table(
    columns: (1fr, auto, auto),
    align: (left, right, right),
    stroke: rgb("#e0e0e0"),
    inset: 10pt,
    table.header(
      text(weight: "bold")[Categoria],
      text(weight: "bold")[Valor],
      text(weight: "bold")[% do Total]
    ),
    ..categories.map(cat => (
      cat.name,
      cat.amount,
      cat.percentage
    )).flatten()
  )
}

#v(0.5cm)

// --- GRÁFICO DE BARRAS (básico) ---
= Distribuição de Gastos

#{
  let max-val = categories.map(c => c.value).fold(0, (a, b) => if b > a { b } else { a })
  for cat in categories {
    let pct = if max-val > 0 { cat.value / max-val * 100 } else { 0 }
    [
      #text(size: 9pt, fill: rgb("#666"))[#cat.name]
      #v(2pt)
      #block(width: 100%)[
        #block(width: pct * 1%, height: 14pt, fill: rgb("#6c5ce7"), radius: 2pt)
        #h(4pt)
        #text(size: 8pt, fill: rgb("#888"))[#cat.amount (#cat.percentage)]
      ]
      #v(4pt)
    ]
  }
}

#v(0.5cm)

// --- SUGESTÕES ---
= Sugestões de Economia

#for (i, suggestion) in suggestions.enumerate() [
  #{
    let num = i + 1
    text(weight: "bold", fill: rgb("#6c5ce7"))[#num.]
  }
  #h(4pt)
  #suggestion
  #v(0.3cm)
]

#v(1cm)

// --- COMPARAÇÃO MÊS A MÊS ---
#if previous-month != none [
  = Comparação com o Mês Anterior

  #{
    table(
      columns: (1fr, auto, auto, auto),
      align: (left, right, right, right),
      stroke: rgb("#e0e0e0"),
      inset: 10pt,
      table.header(
        text(weight: "bold")[Métrica],
        text(weight: "bold")[Mês Atual],
        text(weight: "bold")[Mês Anterior],
        text(weight: "bold")[Variação]
      ),
      [Gastos], expense, previous-month.expense, previous-month.expense-diff,
    )
  }
]
