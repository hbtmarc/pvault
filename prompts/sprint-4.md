# Sprint 4 - Cartoes, Faturas e Parcelado

## O que foi feito
- CRUD de cartoes (criar/editar/arquivar) com fechamento e vencimento.
- Lancamentos suportam forma de pagamento (cash ou cartao) + preview da fatura.
- Compras parceladas criam um plano e so materializam parcelas quando marcado como pago.
- Dashboard e Lancamentos exibem previstos de recorrencias e parcelas.
- Pagina de Faturas com total do ciclo e botao "Marcar fatura como paga" (transfer).
- Index novo para consulta por cardId + statementMonthKey + date.

## Como usar
1) Cadastre um cartao em `#/app/cards`.
2) Crie um lancamento com **Cartao** e selecione o cartao.
3) Para parcelar, marque **Parcelar** e informe o numero de parcelas.
4) Em `#/app/statements`, selecione o cartao e o mes para ver a fatura.
5) Clique **Marcar fatura como paga** para registrar o pagamento (tipo `transfer`).

## Deploy de indexes
```bash
firebase deploy --only firestore:indexes
```

## Limitacoes do MVP
- Parcelas futuras sao previstas no cliente e materializadas sob demanda.
- Pagamento de fatura nao possui estorno/reabertura automatica.
- Edicao de parcelas existentes nao atualiza o plano de parcelamento.

## TODO Sprint 5
- Historico de faturas pagas com reabrir.
- Ajuste fino de parcelas (recalculo e cancelamento do plano).
- Relatorio por cartao e limite consumido.
