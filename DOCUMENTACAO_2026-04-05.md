# Documentação de Alterações - 2026-04-05

Data/hora de consolidação: 2026-04-05 23:34:19 -03
Projeto: `zyba-catalyst` (frontend `zyba-app` + backend `functions/Zoho_api`)

## 1) Resumo executivo
Durante o dia foi realizado um refactor amplo de frontend com novo design system da marca, reconstrução da experiência de login/OTP, reformulação da página TRIPS e ajustes de infraestrutura local para testes no iPhone pela rede interna.

Também foram aplicadas correções de conectividade entre frontend e backend (rewrite de `/api`) e normalização de assets (logos, fontes e ícones).

## 2) Entregas principais

### 2.1 Design system e branding
- Definição de paleta oficial com variáveis CSS:
  - Creme `#F4E9D3`
  - Azul `#72B5DD`
  - Amarelo `#F4F26A`
  - Laranja `#FF6F41`
  - Preto `#232323`
  - Verde Bandeira `#106034`
  - Verde Militar `#626D50`
- Tipografia padronizada:
  - `BL Melody`
  - `BL Melody Mono`
- Tokens tipográficos adicionados para `H2`, `H4`, `H5` e classes utilitárias.
- Botão padrão unificado (site-wide):
  - fundo verde militar
  - texto creme
  - radius 10
  - efeito de clique (active/focus/transition)

Arquivos principais:
- `zyba-app/app/globals.css`
- `zyba-app/public/fonts/*`

### 2.2 Assets de marca
- Inclusão e padronização de logos:
  - `Trans_Creme.png`
  - `Trans_preto.png`
  - `Trans_Simb_Creme.png`
- Inclusão do ícone de email da tela de login:
  - `zyba-app/public/icons/email.png`

Pastas:
- `zyba-app/public/brand/`
- `zyba-app/public/fonts/`
- `zyba-app/public/icons/`

### 2.3 Splash (página inicial)
- Tela inicial convertida para splash com:
  - fundo preto
  - logo creme centralizado
  - tamanho `214x102`
  - fade-in de ~3 segundos
- Redirecionamento automático para `/login` após ~3s.

Arquivo:
- `zyba-app/app/page.tsx`

### 2.4 Login + OTP
- Redesign da página de login conforme referência visual:
  - layout, paddings e gaps específicos
  - logo superior `113x53`
  - ícone `email.png` `112x62`
- Etapa OTP reformulada com:
  - textos de sucesso e instrução em inglês
  - input com 6 caixas (1 dígito por caixa)
  - autoavanço, backspace inteligente e suporte a colar código
- Mensagem de erro para código inválido:
  - texto: `Invalid code, please try again!`
  - posição: entre campos e botão
  - fonte: 14px

Arquivo:
- `zyba-app/app/login/page.tsx`

### 2.5 Página TRIPS
- Reestruturação visual da tela TRIPS conforme mock aprovado:
  - header preto (206px)
  - bloco usuário com símbolo e saudação
  - ícone de notificação no topo
  - body branco
  - carrossel horizontal de cards
- Ajustes posteriores solicitados:
  - remoção da seção de notifications
  - body ocupando altura útil entre header e footer
  - cards com altura ampliada e depois limitada à viewport para evitar rolagem
  - remoção de padding direito do body (card encostando à direita)
  - aumento de padding interno do card para 30px
  - overlay gradiente preto no bottom para legibilidade
  - título do card em H2
  - logo do header com largura 31px e altura proporcional

Arquivo:
- `zyba-app/app/trips/page.tsx`
- estilos em `zyba-app/app/globals.css`

### 2.6 Footer / navegação inferior
- Footer ajustado para:
  - altura 78px
  - fundo verde militar
  - ícones e textos em creme
  - efeito de clique

Arquivo:
- `zyba-app/app/globals.css`
- navegação: `zyba-app/components/BottomNav.tsx`

### 2.7 Performance e cache
- Remoção do cache de sessão customizado do frontend:
  - removidos `zyba-app/lib/cache.ts` e `zyba-app/lib/trip-cache.ts`
- Requisições em `lib/api.ts` configuradas com `cache: "no-store"`.
- Limpeza de build cache (`.next`) durante o processo.

Arquivo:
- `zyba-app/lib/api.ts`

### 2.8 Conectividade local (iPhone)
- Execução com bind em rede local (`0.0.0.0`) para teste no celular.
- Ajustes em `next.config.ts`:
  - `allowedDevOrigins` atualizado com IP local
  - correção de `rewrites` para apontar `/api/*` ao backend correto do Catalyst

Arquivo:
- `zyba-app/next.config.ts`

## 3) Problemas encontrados e resolução

### 3.1 OTP não enviava no celular
Causa raiz:
- Rewrite de `/api/:path*` apontando para porta incorreta.

Correção:
- Rewrite ajustado para `http://127.0.0.1:3000/server/Zoho_api/:path*`.

### 3.2 Navegação instável no acesso móvel
Causa raiz:
- Origem remota bloqueada pelo `allowedDevOrigins` no Next em modo dev.

Correção:
- Inclusão do host/IP local permitido em `next.config.ts`.

### 3.3 Alerta de hydration mismatch observado em logs
Observação:
- Log mostrou atributo injetado por extensão (`__gchrome_uniqueid`), típico de interferência de extensão no browser.
- Não houve quebra de build por esse motivo.

## 4) Status de validação
Comandos executados em múltiplos ciclos durante o dia:
- `npm run lint` (passou)
- `npm run build` (passou)

Status final no encerramento:
- Servidores encerrados a pedido.

## 5) Arquivos com alterações relevantes no dia
- `zyba-app/app/globals.css`
- `zyba-app/app/page.tsx`
- `zyba-app/app/login/page.tsx`
- `zyba-app/app/trips/page.tsx`
- `zyba-app/lib/api.ts`
- `zyba-app/next.config.ts`
- `zyba-app/public/brand/*`
- `zyba-app/public/fonts/*`
- `zyba-app/public/icons/email.png`
- `zyba-app/lib/cache.ts` (removido)
- `zyba-app/lib/trip-cache.ts` (removido)
- `zyba-app/app/page.module.css` (removido)

Também há alterações de backend já presentes no working tree:
- `functions/Zoho_api/routes/crm.js`
- `functions/Zoho_api/services/zoho.js`

Nota: essas alterações de backend não foram revertidas e permanecem no estado atual do projeto.

## 6) Pendências / próximos passos recomendados
- Criar central de notificações (engine por regras) sem dependência de consulta em tempo real ao CRM.
- Padronizar ícones do footer para os arquivos anexados pelo cliente (mantendo cor creme).
- Converter textos provisórios da TRIPS para dados dinâmicos finais.
- Revisar warnings visuais de imagem (`width/height`) para eliminar avisos no dev console.
- Opcional: preparar commit por blocos funcionais (Design System, Login/OTP, Trips, Infra local).

## 7) Observação operacional
Para testes em iPhone (mesma rede), em dev:
- Frontend: `http://<IP_LOCAL>:3001`
- Backend Catalyst via rewrite interno do Next para `127.0.0.1:3000`.

## 8) Atualização de estabilização (2026-04-06)

Após os testes online em Vercel + Catalyst, foi feita estabilização focada em autenticação/sessão.

### 8.1 Problemas reais encontrados
- Fluxo OTP funcionava, mas rotas protegidas retornavam `401`/`INVALID_TOKEN`.
- CORS ao chamar Catalyst direto do browser em produção.
- Divergência entre comportamento via Vercel `/api` e chamada direta ao Catalyst.

### 8.2 Causa raiz técnica
- `CACHE_SEGMENT_ID` grande perdia precisão ao ser convertido para `Number` no backend.
- Header `Authorization` com token de sessão era tratado como OAuth pelo gateway Catalyst em alguns cenários.

### 8.3 Correções finais aplicadas
- `functions/Zoho_api/services/cache.js`:
  - segmento de cache agora tratado como string (sem conversão numérica).
- `zyba-app/app/api/[...path]/route.ts`:
  - criado proxy interno para o backend Catalyst.
  - remoção de `Authorization` ao encaminhar para Catalyst.
- `zyba-app/next.config.ts`:
  - removido rewrite externo de `/api` (evita conflito com proxy interno).
- `zyba-app/lib/api.ts`:
  - estratégia única: browser chama sempre `"/api"` (same-origin).

### 8.4 Commits de referência (estabilização)
- `012da28` fix: avoid numeric precision loss on cache segment id
- `d981380` fix: replace vercel external rewrite with internal api proxy route
- `e604a69` fix: strip authorization header in internal api proxy for catalyst

### 8.5 Estado final esperado
- OTP funcionando em produção.
- `/api/auth/session` validando sessão corretamente.
- `/api/crm/trips` e demais rotas protegidas retornando dados sem `401`.

## 9) Atualização funcional e UX (2026-04-07)

Data/hora de consolidação desta atualização: 2026-04-07

### 9.1 Central de notificações (regra inicial)
- Implementada central de notificações com badge no ícone de sino e tela overlay dedicada:
  - rota nova: `/notifications`
  - badge laranja com número de notificações ativas no header
  - lista com link direto para a página de documentos da trip
- Regra inicial implementada:
  - se `Documents_Acknowledged` for `false`, gerar notificação:
    - `You need to check some importante Documents for your trip {TRIP SUBJECT}`

Arquivos principais:
- `zyba-app/components/NotificationsBell.tsx`
- `zyba-app/app/notifications/page.tsx`
- `zyba-app/lib/notifications.ts`
- `zyba-app/lib/notifications-service.ts`
- `zyba-app/app/globals.css`

### 9.2 Backend para suportar regra por trip
- Endpoint de listagem de trips atualizado para incluir `Documents_Acknowledged`:
  - `functions/Zoho_api/services/zoho.js`
  - COQL agora retorna `Documents_Acknowledged`
  - payload normalizado com `documentsAcknowledged`
- Resultado:
  - frontend consegue decidir notificação sem depender apenas da página de documentos.

### 9.3 Resiliência contra inconsistência de cache/dados
- Implementado fallback no frontend:
  - quando `documentsAcknowledged` não vem em `/crm/trips`, a aplicação consulta `/crm/trips/:id/requirements` por trip para fechar a regra.
- Efeito:
  - elimina falso negativo de notificação em cenários de payload parcial ou propagação lenta.

### 9.4 Correção UX na página Documents (acknowledge)
- Problema reportado:
  - após clicar em `I understand and acknowledge`, UI às vezes continuava exigindo validação por dado stale.
- Correção aplicada:
  - atualização otimista imediata (`documentsAcknowledged=true`) para remover o botão na hora.
  - sincronização em background com retry curto para absorver delay de propagação Zoho.
  - separação de estado de envio (`isSubmitting`) do estado de carregamento da página (`loading`).

Arquivo:
- `zyba-app/app/trips/[id]/documents/page.tsx`

### 9.5 Ajustes de layout e navegação
- Botão `I understand and acknowledge`:
  - movido para baixo do último card de documents
  - fundo laranja
  - evita sobreposição com botão fixo `Back to trip details`
- Inclusão de botão de voltar (seta à esquerda) antes do título nas páginas:
  - Documents
  - Hotel Informations
  - Transfer Informations
  - Full Itinerary
- Comportamento do botão de voltar:
  - usa `router.back()` com fallback para `Trip Details`
- Logo do header transformado em link para `/trips` nas telas com cabeçalho.

Arquivos:
- `zyba-app/app/trips/[id]/documents/page.tsx`
- `zyba-app/app/trips/[id]/hotel-information/page.tsx`
- `zyba-app/app/trips/[id]/transfer-information/page.tsx`
- `zyba-app/app/trips/[id]/full-itinerary/page.tsx`
- `zyba-app/app/trips/[id]/flight-information/page.tsx`
- `zyba-app/app/trips/[id]/shop-gears/page.tsx`
- `zyba-app/app/trips/[id]/page.tsx`
- `zyba-app/app/trips/page.tsx`
- `zyba-app/app/profile/page.tsx`
- `zyba-app/app/globals.css`

### 9.6 Ajustes específicos na Transfer Information
- Campo `Car Photo Files` passou a renderizar imagens (não só nomes de arquivo).
- Largura aplicada por item: `50%`.

Arquivo:
- `zyba-app/app/trips/[id]/transfer-information/page.tsx`
- `zyba-app/app/globals.css`

### 9.7 Correção de hydration mismatch
- Causa:
  - `getSessionToken()` era chamado direto no `href` do botão PDF durante render.
- Correção:
  - token movido para estado client-only (`useEffect`) antes de montar URL.

Arquivo:
- `zyba-app/app/trips/[id]/page.tsx`

### 9.8 Validação executada
- `npm run lint` (passou)
- `npm run build` (passou)

Observação:
- Há warning não-bloqueante de performance na Transfer (`<img>` em vez de `<Image>`), sem erro funcional.

### 9.9 Commit de referência desta atualização
- `0ae4c68` feat: notifications center, docs ack UX fix, and header/back navigation polish

## 10) Atualização UX, status e loading (2026-04-10)

### 10.1 Ajustes de status para listagem de trips
- Filtro de trips no backend atualizado para considerar novos status oficiais do CRM:
  - `Approved`
  - `Rescheduled`
- A query de `Sales_Orders` agora usa `Status in ('Approved', 'Rescheduled')`.

Arquivo:
- `functions/Zoho_api/services/zoho.js`

### 10.2 Login: campo de email e modal de ajuda
- Removido valor fixo do input de email.
- Placeholder adicionado:
  - `Your Email here`
  - estilo regular (sem negrito), com cor mais clara que o preto base.
- `Need help?` convertido em link com abertura de modal tipo bottom sheet:
  - overlay preto 80% (parte superior)
  - painel inferior ocupando 50% da tela
  - fundo creme
  - cantos superiores arredondados (20px)
  - título: `Do you need help?`
  - gap de 60px entre título e lista
  - links:
    - `Mail us` (ícone SVG)
    - `Call us` (ícone SVG)
  - botão de fechamento `X` no canto superior direito

Arquivos:
- `zyba-app/app/login/page.tsx`
- `zyba-app/app/globals.css`
- `zyba-app/public/icons/help-mail.svg`
- `zyba-app/public/icons/help-call.svg`

### 10.3 Transfer Information: fotos do carro
- Corrigida montagem da URL dos anexos para carregar imagens reais no app:
  - padrão aplicado: `Sales_Orders_{tripId}_{attachmentId}`
- Campo `Car Photo Files` agora renderiza miniaturas com `width: 50%`.

Arquivo:
- `zyba-app/app/trips/[id]/transfer-information/page.tsx`
- estilos em `zyba-app/app/globals.css`

### 10.4 Skeleton loading padronizado (perceived performance)
- Implementado padrão visual de loading com shimmer em seções de dados:
  - `Trips`
  - `Trip Details`
  - `Documents`
  - `Hotel Informations`
  - `Transfer Informations`
  - `Full Itinerary`
  - `Profile`
- Header/footer permanecem visíveis enquanto os dados carregam no body.

Arquivos:
- `zyba-app/app/globals.css`
- `zyba-app/app/trips/page.tsx`
- `zyba-app/app/trips/[id]/page.tsx`
- `zyba-app/app/trips/[id]/documents/page.tsx`
- `zyba-app/app/trips/[id]/hotel-information/page.tsx`
- `zyba-app/app/trips/[id]/transfer-information/page.tsx`
- `zyba-app/app/trips/[id]/full-itinerary/page.tsx`
- `zyba-app/app/profile/page.tsx`

### 10.5 Ajuste de conteúdo Shop Gears
- Texto de `Coming soon` substituído por versão resumida em inglês:
  - `We are preparing the best gear for your trip. Soon, you will be able to buy everything you need at the best prices.`

Arquivo:
- `zyba-app/app/trips/[id]/shop-gears/page.tsx`

### 10.6 Revisão técnica desta rodada
- Sem falhas críticas bloqueadoras encontradas.
- Ponto menor pendente:
  - warning de lint em `Transfer Information` por uso de `<img>` (performance/LCP), sem impacto funcional no fluxo atual.

### 10.7 Política de cache otimizada (foco em performance + consistência)
- Objetivo:
  - manter navegação rápida para consultas frequentes;
  - evitar inconsistência na tela de `Documents`, que exige atualização imediata.
- Ajustes aplicados no backend (`services/zoho.js`):
  - `traveler:{email}`: TTL de `5 min`
  - `trips:{email}`: TTL de `3 min`
  - `trip-details:{tripId}:{email}`: TTL de `2 min`
  - `record:Deals:{dealId}`: TTL de `5 min`
  - `trip-requirements:{tripId}:{email}`: **cache removido** (sempre consulta Zoho)
- Variáveis opcionais para override de TTL:
  - `DATA_CACHE_TTL_TRAVELER_MS`
  - `DATA_CACHE_TTL_TRIPS_MS`
  - `DATA_CACHE_TTL_TRIP_DETAILS_MS`
  - `DATA_CACHE_TTL_DEALS_MS`
- Resultado esperado:
  - `Documents` sempre com estado mais atual;
  - demais telas com resposta mais rápida e baixo risco de desatualização dentro do limite de 5 minutos.

### 10.8 Commit de referência (cache)
- `91d3d48` perf: tune API cache TTLs and disable documents requirements cache
