# Sprint 0 - Controle Financeiro

## Resumo do que foi feito
- Base Vite + React + TypeScript com TailwindCSS.
- HashRouter e rotas protegidas com contexto de autenticacao.
- Fluxo completo de Auth (login, cadastro, reset, logout) usando Firebase SDK v9.
- Workflow de deploy no GitHub Pages usando `actions/deploy-pages`.
- Scaffold de Firestore (rules + emulator configs).

## TODO (pendencias manuais)
- [ ] Criar projeto no Firebase e habilitar Email/Password.
- [ ] Substituir o `projectId` em `.firebaserc`.
- [ ] Criar `.env.local` com as chaves `VITE_FIREBASE_*`.
- [ ] Adicionar dominios autorizados no Firebase Auth (inclua `localhost` e o dominio do GitHub Pages).
- [ ] Rodar `npm install` e `npm run dev` para validar local.
- [ ] Fazer push para o GitHub e confirmar o deploy via Actions.
