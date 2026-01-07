# Sprint 6 - Admin em prod, mes global, subtotais, backup/restore

## O que foi feito
- Admin em producao usa `VITE_ADMIN_UIDS` no build (fail closed).
- MonthProvider global com persistencia em URL `?m=YYYY-MM` e localStorage.
- Subtotais no fim das listas de Lancamentos e Faturas.
- Admin: controle de dados com backup JSON, restore (mesclar/substituir) e wipe.
- Firestore rules liberam admin para read/write em `/users/*` (deny fora disso).

## Decisoes e notas
- Backup schemaVersion=1 com `exportedAt` e `appVersion` (quando existir).
- Timestamps exportados como ISO strings (restaura como string).
- Colecoes exportadas: categories, transactions, budgets, recurringRules, cards, statements,
  installmentPlans, cardStatements.
- Batches de escrita/limpeza com tamanho 450 para folga do limite 500.

## Como testar (manual)
1) Logue como admin (menu Admin visivel).
2) Selecione um usuario e gere backup.
3) Wipe dados financeiros e confirme que listas ficam vazias.
4) Restaure o backup e confirme que os dados voltam.
5) Mude o mes no Dashboard e navegue para Lancamentos/Faturas (mes persiste).

## TODO Sprint 7
- Backup com compressao/zip e progresso percentual.
- Suporte a colecoes novas sem precisar atualizar lista fixa.
- Historico de operacoes de admin (audit log).
