# Sprint 3 - Admin mestre

## O que foi feito
- AdminContext com `authUid`, `effectiveUid`, `isAdmin` e personificacao.
- Rota `/app/admin` protegida (somente admin). Nao-admin redireciona para `/app`.
- Listagem de usuarios em `/users` e acao "Visualizar como".
- Banner discreto quando personificando e UI em modo leitura.
- Upsert do doc `/users/{uid}` no login para indexar usuarios.
- Regras do Firestore com leitura admin e escrita somente do owner.

## Como configurar o admin
1) Descubra o UID do admin em **Firebase Console -> Authentication -> Users**.
2) No `.env.local`, configure (lista separada por virgula):
```bash
VITE_ADMIN_UIDS=UID_DO_ADMIN,OUTRO_UID
```
3) Em `firestore.rules`, substitua `ADMIN_UID` pelo UID do admin.
4) Faca deploy das regras:
```bash
firebase deploy --only firestore:rules
```

## Como testar com 2 usuarios
1) Crie dois usuarios (admin + normal).
2) Logue com o admin:
   - O menu **Admin** aparece.
   - A lista de usuarios carrega.
3) Clique **Visualizar como** em um usuario:
   - Banner "Modo Admin - Visualizando como ..." aparece.
   - Botao de escrita fica desabilitado.
4) Saia do modo admin e volte a escrever.
5) Logue com usuario normal:
   - Nao aparece menu Admin.
   - A rota `#/app/admin` redireciona para `#/app`.
