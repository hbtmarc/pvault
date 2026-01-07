# Sprint 5 - Pagamento de Fatura e Limites

## O que foi feito
- Modal de pagamento da fatura com data e observacao.
- Transacao de pagamento do tipo `transfer` com `paymentKind="card_payment"`.
- Documento de pagamento em `/users/{uid}/statements/{cardId}_{statementMonthKey}`.
- Botao para desmarcar pagamento (remove doc e transacao).
- Limite opcional em cartoes com utilizacao e disponivel no mes selecionado.
- Index atualizado para query de faturas com filtro de paymentMethod.

## Como usar
1) Em **Faturas**, selecione cartao e mes.
2) Clique **Marcar fatura como paga**, ajuste data/observacao e confirme.
3) Para reabrir, use **Desmarcar como paga**.
4) Em **Cartoes**, defina limite e acompanhe utilizacao do mes.

## Indices (opcao A)
Se aparecer erro de indice ("query requires an index" no console ou no banner):
1) Adicione o indice em `firestore.indexes.json`.
2) Rode o deploy:
```bash
firebase deploy --only firestore:indexes
```

Indice novo deste sprint:
- `transactions`: cardId ASC + statementMonthKey ASC + paymentMethod ASC + date DESC

## Smoke test
1) `npm run dev`
2) Criar cartao com limite e dias fechamento/vencimento
3) Criar compra no cartao (parcelado) e verificar fatura
4) Marcar fatura como paga e checar transacao de pagamento (transfer)
5) Desmarcar e validar reversao
6) `npm run build`
