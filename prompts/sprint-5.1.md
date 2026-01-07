# Sprint 5.1 - Parcelamento futuro e pagamento de fatura

## O que foi feito
- Parcelamento no cartao agora materializa N transacoes (uma por parcela).
- Split de centavos centralizado em `splitCentsEven` para soma exata.
- StatementMonthKey calculado por parcela com base no closingDay do cartao.
- Resumo de faturas: mes atual + proximos 5 meses.
- Pagamento de fatura marca os itens da fatura como pagos (paidAt + paidByStatementId).
- Desmarcar pagamento limpa os campos e remove a transacao de pagamento.

## Como testar (manual)
1) Crie um cartao: fechamento 3, vencimento 10.
2) Crie compra no cartao em 12x (R$ 545,00) na data 2026-01-06.
3) Confirme no Firestore 12 docs com installmentIndex 1..12 e valores somando 54500.
4) Veja as faturas futuras (navegue meses).
5) Pague a fatura: status "Paga" e itens ficam com paidAt.
6) Desmarque e confirme limpeza.

## Observacoes
- Indices continuam sendo geridos via `firestore.indexes.json` + deploy.
