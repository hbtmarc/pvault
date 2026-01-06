# Sprint 2 - PVault

## O que foi feito
- Pagina de Orcamento com alocacao mensal por categoria (despesas).
- KPI Disponivel no Dashboard (receita - total alocado).
- Regras de recorrencia mensais com preview de previstos.
- Previsto no Dashboard e Lancamentos com botao Marcar como pago.
- Helpers de Firestore para budgets, recorrencias e geracao de previstos.

## Decisoes de modelo
- budgetId = "${monthKey}_${categoryId}" para upsert simples.
- Previstos sao gerados no cliente e nao gravados no Firestore ate serem pagos.

## TODO Sprint 3
- [ ] Relatorios por categoria com comparacao orcado x gasto.
- [ ] Repeticao semanal e regras mais flexiveis.
- [ ] Ajustes de UX (filtros, busca e ordenacao).
- [ ] Exportacao CSV e backup.