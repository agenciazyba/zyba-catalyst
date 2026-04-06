# Deploy De Teste (GitHub + Online)

## 1) Arquitetura Recomendada

- Frontend: `zyba-app` (Next.js) em Vercel.
- Backend: `functions/Zoho_api` em Zoho Catalyst (Function URL pública).
- Front chama `/api/*`; o Next faz rewrite para o backend via `API_PROXY_TARGET`.

## 2) Variáveis de Ambiente

### Frontend (`zyba-app`)

Use `zyba-app/.env.example` como base:

- `API_PROXY_TARGET`
  - Local: `http://127.0.0.1:3002/server/Zoho_api`
  - Produção: `https://<seu-backend>/server/Zoho_api`

### Backend (`functions/Zoho_api`)

Use `functions/Zoho_api/.env.example` como base.

Obrigatórias para funcionar:

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `OTP_FROM_EMAIL`
- `ZOHO_ACCOUNTS_URL`
- `ZOHO_API_DOMAIN`
- `CATALYST_CACHE_SEGMENT_ID`

## 3) Checklist Antes de Publicar

- `.env` não versionado (já ignorado pelo `.gitignore`).
- `npm run lint` e `npm run build` no frontend.
- Validar login OTP e fluxo Trips/Profile em ambiente de staging.
- Confirmar domínio final para `API_PROXY_TARGET`.

## 4) Subir para GitHub

No diretório raiz:

```bash
git add .
git commit -m "Prepare project for online test deployment"
git branch -M main
git remote add origin https://github.com/<usuario>/<repo>.git
git push -u origin main
```

## 5) Deploy Front (Vercel)

1. Importar repo no Vercel.
2. Root directory: `zyba-app`.
3. Build command: `npm run build`.
4. Environment Variable:
   - `API_PROXY_TARGET=https://<backend-public-url>/server/Zoho_api`
5. Deploy.

## 6) Deploy Back (Catalyst)

No diretório raiz:

```bash
catalyst deploy --only functions
```

Depois, confirmar URL pública da função `Zoho_api` e usar essa URL no `API_PROXY_TARGET` do frontend.

## 7) Teste com Usuários Reais

- Testar em iPhone e Android.
- Testar em 4G (fora da rede local).
- Monitorar:
  - envio OTP
  - latência de consultas CRM
  - erros de sessão expirada

## 8) Riscos Atuais (para acompanhar)

- Dependência de Zoho APIs (latência e limite de rate).
- Sessão baseada em token no `localStorage` (ok para MVP, revisar hardening depois).
- CORS atualmente permissivo no backend (funcional para teste, revisar restrição por domínio em produção definitiva).
