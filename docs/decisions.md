# Decisoes do Sprint 0

- Usar `HashRouter` para evitar 404 em refresh no GitHub Pages (Project Pages).
- Publicar via GitHub Actions (artifact `dist/` + `actions/deploy-pages`) seguindo o guia oficial do Vite.
- Manter Firebase SDK modular v9+ com Auth email/senha agora e Firestore apenas scaffold (rules/emu).
- Configurar base de build no workflow: `npm run build -- --base=/${{ github.event.repository.name }}/`.
- Variaveis sensiveis ficam em `.env.local` (exemplo em `.env.example`).
