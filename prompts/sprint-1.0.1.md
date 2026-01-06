# Sprint 1.0.1 - Hotfix diagnostico de erros

## Causa encontrada
- O banner mostrava apenas mensagem generica e nao exibia o code/message do Firebase, o que ocultava falhas reais (ex: falta de indice ou permission-denied).
- Algumas chamadas podiam acontecer antes do auth estabilizar, entao um uid vazio gerava comportamento inesperado e dificil de rastrear.

## O que foi feito
- Guardas de uid em todas as funcoes do Firestore e logs completos com console.error.
- Logs em DEV para listagens (uid, path e monthKey).
- Banners com detalhes em DEV (code/message) e mensagem especial para erro de indice.
- Skeleton simples em loading para evitar renderizacao precoce.

## Observacoes
- Se aparecer erro de indice, rode: firebase deploy --only firestore:indexes.