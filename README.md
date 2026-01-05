# Controle Financeiro (Sprint 0)

Front-end estatico (Vite + React + TypeScript + Tailwind) com autenticacao Firebase (email/senha) e deploy automatico no GitHub Pages.

## Requisitos
- Node.js 18+ (recomendado 20+)
- npm

## Como rodar localmente (passo a passo)
1) Instale as dependencias:
```bash
npm install
```

2) Crie o projeto no Firebase:
- Acesse https://console.firebase.google.com/
- Crie um projeto (sem Analytics, se preferir)
- Em **Authentication** -> **Sign-in method**, habilite **Email/Password**
- Em **Project settings** -> **General**, crie um app **Web** e copie o `firebaseConfig`

3) Preencha o `.env.local` (nao commitar):
Crie um arquivo `.env.local` na raiz com as chaves do Firebase:
```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

4) Atualize o `projectId` do Firebase CLI:
Edite `.firebaserc` e substitua `your-firebase-project-id` pelo ID do seu projeto.

5) Rode o projeto:
```bash
npm run dev
```
Acesse: `http://localhost:5173/#/login`

## Build local
```bash
npm run build
```
O build sai em `dist/`.

## Deploy automatico no GitHub Pages
1) Suba o projeto para um repositorio no GitHub (branch `main`).
2) Em **Settings -> Pages**, selecione **Build and deployment -> GitHub Actions**.
3) Faca push. O workflow `deploy.yml` ira:
   - instalar dependencias
   - rodar `npm run build -- --base=/${{ github.event.repository.name }}/`
   - publicar o `dist/`

A URL final ficara assim:
```
https://SEU_USUARIO.github.io/NOME_DO_REPO/#/login
```

## Dominios autorizados no Firebase Auth (importante)
Para a autenticacao funcionar no GitHub Pages, adicione seu dominio em:
**Firebase Console -> Authentication -> Settings -> Authorized domains**
- `localhost`
- `SEU_USUARIO.github.io`

## Emuladores Firebase (opcional)
Este projeto ja inclui `firebase.json` com Auth + Firestore + UI.
Se quiser rodar emuladores:
```bash
firebase emulators:start
```

## Estrutura principal
- `src/routes` -> AuthRoutes e ProtectedRoutes
- `src/pages` -> telas Login, Register, ForgotPassword, Home
- `src/lib` -> integracao Firebase/Auth
- `src/providers` -> contexto do usuario logado

## Checklist de validacao
- [ ] Criei projeto Firebase e habilitei Email/Password
- [ ] Preenchi `.env.local` com firebaseConfig
- [ ] `npm run dev` abre a tela de login
- [ ] Consigo criar conta e logar
- [ ] Logout funciona
- [ ] Rotas protegidas bloqueiam acesso sem login
- [ ] GitHub Actions executa build e publica Pages
- [ ] URL do Pages abre o app
