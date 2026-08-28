# Deploy De Teste (GitHub + Online)

## 1) Arquitetura Recomendada

- Frontend: `zyba-app` (Next.js) em Vercel.
- Backend: `functions/Zoho_api` em Zoho Catalyst (Function URL pública).
- Front chama `/api/*` e o Next usa proxy interno em `app/api/[...path]/route.ts` para encaminhar ao backend Catalyst.
- Evitar chamadas diretas do browser para o Catalyst para não cair em CORS.

## 2) Variáveis de Ambiente

### Frontend (`zyba-app`)

Use `zyba-app/.env.example` como base:

- `API_PROXY_TARGET` (ainda suportado para legado, mas o proxy interno é o padrão atual)
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
- `CACHE_SEGMENT_ID`

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
4. Se necessário, manter `API_PROXY_TARGET` apontando para o backend (compatibilidade).
5. Deploy.

## 6) Deploy Back (Catalyst)

O Vercel publica somente o frontend. Sempre que houver alteração em
`functions/Zoho_api/**`, a função `Zoho_api` também precisa ser publicada no
Catalyst.

**Atenção:** não rode deploy direto da raiz sem conferir as variáveis. O arquivo
local `functions/Zoho_api/catalyst-config.json` mantém variáveis sensíveis
vazias por segurança. Um deploy direto com esse arquivo pode sobrescrever o
Development com valores em branco e causar:

- `invalid_client`
- `Apple review login is not configured`

Deploy seguro pelo terminal:

```bash
npx zcatalyst-cli deploy --only functions:Zoho_api
```

Use esse comando somente a partir de uma cópia temporária/preparada com as
variáveis corretas, ou depois de confirmar que o `catalyst-config.json` usado no
deploy contém valores válidos para o ambiente alvo. Não commitar arquivos com
segredos.

Depois, confirmar URL pública da função `Zoho_api` e usar essa URL no
`API_PROXY_TARGET` do frontend.

### 6.1) Regra anti `Route not found`

Sempre que um commit alterar qualquer arquivo em `functions/Zoho_api/**`, o deploy do Vercel não é suficiente.
Nesses casos, publique também a função `Zoho_api` no Catalyst e rode:

```bash
./scripts/check-catalyst-routes.sh
```

O check valida:

- `/health` retorna `ok: true`
- rotas CRM protegidas retornam `Unauthorized` sem sessão
- uma rota nova que retornaria `Route not found` falha o script imediatamente

Exemplo de leitura:

- `Unauthorized`: rota publicada e protegida corretamente
- `Route not found`: função Catalyst publicada ainda não tem a rota nova

Variáveis opcionais:

```bash
CATALYST_BASE_URL="https://<backend>/server/Zoho_api" ./scripts/check-catalyst-routes.sh
HOTELS_TRIP_ID="6623116000003137040" ./scripts/check-catalyst-routes.sh
```

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

## 9) Lições Aprendidas (Incidente 401/INVALID_TOKEN)

Sintoma observado:
- OTP funcionava, mas `/api/auth/session` e `/api/crm/*` retornavam `401` e/ou `INVALID_TOKEN`.

Causas identificadas:
- ID de segmento de cache muito grande sendo convertido para `Number` (perda de precisão em JS).
- Proxy externo/rewrite inconsistente em alguns cenários de Vercel.
- Header `Authorization` com token de sessão chegando ao gateway Catalyst e sendo interpretado como OAuth.

Correções consolidadas:
- `CACHE_SEGMENT_ID` tratado como string no backend (`services/cache.js`).
- Proxy interno do Next criado em `app/api/[...path]/route.ts`.
- Remoção do header `Authorization` no proxy interno antes de chamar o Catalyst.
- Estratégia única no frontend: browser chama apenas `"/api"` (same-origin).

Playbook de diagnóstico (rápido):
1. Testar sessão direta no Catalyst:
   - `/server/Zoho_api/auth/session?sessionToken=<token>`
2. Testar sessão via Vercel:
   - `/api/auth/session?sessionToken=<token>`
3. Se direto funciona e Vercel falha:
   - revisar proxy interno e headers encaminhados.
4. Se ambos falham:
   - revisar `CACHE_SEGMENT_ID` e deploy da função.
