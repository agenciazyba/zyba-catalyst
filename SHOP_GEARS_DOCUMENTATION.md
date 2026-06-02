# Shop Gears Documentation

## Objetivo

Documentar a funcionalidade `Shop Gears` do app Zyba e registrar correções aplicadas com:

- causa
- solução
- arquivos impactados

Este arquivo deve ser atualizado sempre que um erro da funcionalidade `Shop Gears` for corrigido.

---

## Escopo atual

Fluxo atual implementado:

- listagem de `Products` do Zoho CRM na página `Shop Gears`
- filtro por `Destination_Related` usando o destino/vendor vinculado ao `Deal` da trip
- filtro horizontal por `Category` na UI, usando as opções do Pick List `Category` do módulo `Products`
- exibição somente de produtos com `Product_Active` marcado
- card de produto com imagem, SKU, nome, preço, quantidade, add/remove e atalho para detalhes
- detalhe de produto exibido apenas em modal/bottom sheet sobre a lista
- carrinho persistido no backend por `session + tripId`
- cache local do carrinho no app por `tripId`
- botão flutuante `Tackle box` com total, contador de itens e navegação para `Cart`

Arquivos principais:

- `functions/Zoho_api/services/zoho.js`
- `functions/Zoho_api/routes/crm.js`
- `zyba-app/components/AddTackleButton.tsx`
- `zyba-app/lib/shop-cart.ts`
- `zyba-app/app/trips/[id]/shop-gears/page.tsx`
- `zyba-app/app/trips/[id]/shop-gears/cart/page.tsx`
- `zyba-app/components/AppTopBar.tsx`
- `zyba-app/app/globals.css`

---

## Arquitetura resumida

### Backend

Rotas principais:

- `GET /api/crm/products`
- `GET /api/crm/products/categories`
- `GET /api/crm/products/:productId`
- `GET /api/crm/cart`
- `POST /api/crm/cart/items`
- `PATCH /api/crm/cart/items/:productId`
- `DELETE /api/crm/cart/items/:productId`
- `DELETE /api/crm/cart`
- `POST /api/crm/checkout/session`
- `GET /api/crm/checkout/status`
- `POST /api/crm/checkout/finalize`

Origem dos dados:

- módulo Zoho: `Products`
- produtos separados pelo campo `Category`
- categorias do menu horizontal vêm do Pick List `Category`
- opções vazias, `None` e `-None-` não devem aparecer no menu

Campos usados:

- `Color`
- `Category`
- `Description`
- `Record_Image`
- `Destination_Related`
- `Layout`
- `Essential`
- `Product_Active`
- `Product_Code`
- `Product_Recommended` (campo legado ainda mapeado no backend, mas não controla o badge atual)
- `Product_Image_Catalog`
- `Product_Image_Real`
- `Product_Name`
- `Unit_Price`
- `Vendor_Name`

### Frontend

Páginas:

- `Shop Gears`:
  - lista de produtos
  - menu horizontal de `Category` carregado do Pick List do CRM
  - badge verde `ESSENTIAL` quando o campo booleano `Essential` vier marcado no CRM
  - imagem principal do produto preenchendo o frame do card
  - quantidade
  - `ADD TO TACKLE BOX`
  - `REMOVE` quando produto já existe no carrinho
  - botão flutuante `Tackle box`
- `Product Details Modal`:
  - abre ao clicar na imagem, ícone de informação ou nome do produto
  - bottom sheet com 90% da altura da tela
  - backdrop preto com transparência
  - imagem, preço, nome, SKU, brand, description, quantidade e `ADD TO TACKLE BOX`
  - fechamento por botão `X`, backdrop, tecla `Escape` ou arraste para baixo
- `Cart`:
  - título `My Tackle Box`
  - itens adicionados
  - ajuste de quantidade
  - remoção por item com botão `REMOVE`
  - subtotal
  - discount
  - shipping
  - total
  - botão `PAY NOW`
  - botão secundário `CONTINUE SHOPPING`

Observações:

- a opção de limpar carrinho completo foi removida da UI
- o campo `Order notes` foi removido e não é enviado para Stripe
- o antigo arquivo de rota `zyba-app/app/trips/[id]/shop-gears/[productId]/page.tsx` foi removido; detalhes devem abrir por modal

Persistência atual:

- fonte de verdade do carrinho no backend da função `Zoho_api`
- persistência em cache segmentado da função por chave opaca de sessão + `tripId`
- `localStorage` mantido no frontend apenas como snapshot/cache de render
- sincronização automática do carrinho ao abrir as páginas de `Shop Gears`
- snapshots locais `zyba_shop_cart:*` são removidos em novo login e logout
- carrinhos de sessões antigas não são reaproveitados após logout/login

---

## Cache

### Padrão adotado no projeto

O frontend autenticado usa `fetch` com `cache: "no-store"` e a economia de chamadas acontece no backend.

### Shop Gears

Cache backend aplicado em `functions/Zoho_api/services/zoho.js`:

- `TTL_PRODUCTS_MS`
- cache da lista de products por combinação de filtros
- cache do detalhe por `productId + layout + category`
- cache dos campos do módulo `Products`
- cache das opções de Pick List usadas pelo menu de categorias

Objetivo:

- reduzir chamadas repetidas ao Zoho
- manter o mesmo padrão das demais áreas do app

TTL atual:

- products list/detail/categories: `TTL_PRODUCTS_MS`, padrão 2 minutos
- front usa `cache: "no-store"`; a economia de API acontece no backend
- imagens dos produtos são streamadas pelo endpoint `/api/crm/files/:fileId`

### Carrinho e sessão

O carrinho não deve sobreviver a um ciclo de logout + novo login.

Regras atuais:

- frontend limpa snapshots locais `zyba_shop_cart:*` ao fazer logout
- frontend limpa snapshots locais antes de salvar um novo `sessionToken`
- backend usa uma chave de dono derivada do token de sessão, não o email puro do usuário
- a chave persistida do carrinho é isolada por `session + tripId`
- o logout chama `/auth/logout` como best-effort para invalidar a sessão no backend
- o webhook Stripe recebe `cartOwnerKey` no metadata para limpar o carrinho da sessão correta após pagamento
- estado de checkout é persistido em Catalyst Cache para suportar o retorno do Stripe e a finalização da Sales Order
- após checkout aprovado, o snapshot local da trip é limpo

Isso evita que um carrinho antigo de outro login, outro browser ou outro ciclo de sessão apareça novamente em `Shop Gears`.

### Política geral de cache do app

Data:

- 2026-06-02

Regras atuais:

- `Documents/Requirements` fica sem cache de Trip Details para refletir imediatamente o aceite dos termos.
- `Flights`, `Full Itinerary`, `Hotels`, `Hotel Details` e `Transfer` usam cache backend de 5 minutos.
- `My Trips` e `My Orders` usam cache backend de 3 minutos.
- `Profile/Traveler` usa cache backend de 5 minutos.
- `Shop Gears` usa cache backend de 2 minutos para produtos e categorias.
- atualizações feitas pelo app via `zohoUpdateRecord` invalidam o cache do record alterado.
- rotas de dados no front continuam usando `cache: "no-store"` para evitar cache de browser/Next.

Objetivo:

- reduzir consumo de API Zoho nas páginas estáveis
- manter leitura imediata em `Documents` após aceite
- preservar UX rápida sem reaproveitar carrinho de sessões antigas

---

## UI e microinteractions

### Atualizações recentes

Data:

- 2026-05-20
- 2026-05-21

Melhorias aplicadas:

- redesign da página `Shop Gears` seguindo layout mobile de catálogo:
  - título com destino da trip em destaque
  - menu horizontal por `Category`
  - cards maiores com foto, SKU, nome, preço e controles de quantidade
  - ícone de detalhes no card do produto
  - selo `ESSENTIAL` quando `Essential` vier marcado no CRM
  - imagem do card usando preenchimento do frame
  - botão flutuante `Tackle box` alinhado à direita, com total e contador de itens
- componente reutilizável `AddTackleButton` para ações de adicionar produto:
  - estado inicial laranja `ADD TO TACKLE BOX`
  - estado `ADDING` com barra de progresso laranja escura
  - estado final verde `ADDED`
  - retorno automático ao estado inicial
- feedback visual temporário ao adicionar item no carrinho com:
  - nome do produto
  - ícone de check
  - card verde
  - fade in / fade out em `2s`
- feedback visual temporário ao remover item do carrinho com:
  - nome do produto
  - ícone de lixeira
  - card laranja
  - fade in / fade out
- botão `ADD TO CART` entra em estado `ADDED` e fica desabilitado até voltar ao estado inicial
- badge do `tackle box` no topo pulsa quando um item é adicionado
- `PAY NOW` ganhou estado de processamento mais claro antes do redirecionamento para Stripe
- detalhe do produto passou a abrir apenas como modal na lista de `Shop Gears`
- miniaturas de produto na lista e no carrinho passaram a usar `object-fit: contain`
- card da imagem no modal de detalhe do produto passou a usar fundo branco
- botão `Back to my trips` removido da página principal de `Shop Gears`
- menu horizontal de categorias passou a usar o Pick List `Category` do módulo `Products`
- opções vazias, `None` e `-None-` são filtradas fora do menu de categorias
- lista de produtos segue carregando apenas itens com `Product_Active=true`
- nome do produto no card deixou de navegar para página antiga e passou a abrir o modal de detalhes
- rota antiga de detalhe individual foi removida para evitar duas experiências concorrentes
- modal de detalhe passou a ocupar 90% da tela e justificar o texto de `Description`
- fallback de descrição do modal é `No description available.`
- página do carrinho foi redesenhada como `My Tackle Box`
- card do carrinho passou a agrupar produtos com imagem, SKU/category, preço, quantidade e `REMOVE`
- botão `REMOVE` do carrinho ganhou ícone de lixeira
- seletor de quantidade do carrinho usa o mesmo padrão visual da página de produtos
- resumo do carrinho exibe `Subtotal`, `Discount`, `Shipping` e `Total`
- `Shipping` aparece como `FREE` quando o valor for zero
- botão `PAY NOW` ganhou ícone de cadeado e carregamento com barra laranja escura
- botão secundário `CONTINUE SHOPPING` retorna para a página de produtos
- opção de limpar carrinho completo foi removida
- campo `Order notes` foi removido da UI e do payload de checkout
- botão de voltar visual, sem texto, foi padronizado acima dos títulos das páginas internas
- estados vazios de `Documents`, `Itinerary`, `Hotels` e `Transfer` usam a mensagem padrão:
  - `This information is not available yet, but we're working on it. You'll receive a notification as soon as it's ready.`
- login passou a permitir reenvio de OTP com cooldown visual de 60 segundos
- backend limita reenvio de OTP a 5 solicitações por email em janela de 15 minutos

Arquivos principais:

- `zyba-app/components/AddTackleButton.tsx`
- `zyba-app/components/TripBackLink.tsx`
- `zyba-app/app/login/page.tsx`
- `zyba-app/app/trips/[id]/shop-gears/page.tsx`
- `zyba-app/app/trips/[id]/shop-gears/cart/page.tsx`
- `zyba-app/components/AppTopBar.tsx`
- `zyba-app/lib/shop-cart.ts`
- `zyba-app/app/globals.css`
- `functions/Zoho_api/routes/auth.js`
- `functions/Zoho_api/services/zoho.js`

### Navegação e descoberta do Shop Gears

Data:

- 2026-05-04

Melhorias aplicadas na área de trips:

- remoção de títulos redundantes em `Trip Details`
- atualização dos ícones do menu da trip para versão ilustrada
- ícone de `Shop Gears` com fundo transparente e traços brancos para uso no card laranja
- microinteração no carrossel de `My Trips` com card em foco levemente ampliado
- animação de entrada em cascata nas páginas:
  - `Trip Details`
  - `Transfer`
  - `Hotel`
  - `Full Itinerary`

Arquivos principais:

- `zyba-app/app/trips/page.tsx`
- `zyba-app/app/trips/[id]/page.tsx`
- `zyba-app/app/trips/[id]/transfer-information/page.tsx`
- `zyba-app/app/trips/[id]/hotel-information/page.tsx`
- `zyba-app/app/trips/[id]/full-itinerary/page.tsx`
- `zyba-app/app/globals.css`
- `zyba-app/public/icons/trip-*.png`

---

## Stripe Integration Docs

### Status atual

Implementado nesta etapa:

- criação de `Stripe Checkout Session`
- redirecionamento do botão `PAY NOW` para a URL hospedada do Stripe
- webhook Stripe com verificação de assinatura
- persistência do status de checkout por `tripId`
- página de sucesso do app após retorno da Stripe
- limpeza do carrinho após pagamento confirmado
- metadata `cartOwnerKey` na sessão Stripe para limpar o carrinho da sessão correta
- preservação do status final do checkout para a futura etapa de `Sales Order`

Ainda pendente:

- testes end-to-end com pagamento Stripe real em ambiente de desenvolvimento/staging
- estratégia administrativa para reprocessar pedidos pagos caso o usuário não retorne para a página de sucesso

### Fluxo do checkout

1. usuário monta o carrinho em `Shop Gears`
2. carrinho persistido no backend por chave opaca de sessão + `tripId`
3. usuário abre `My Tackle Box`
4. ao clicar em `PAY NOW`, o app chama `POST /api/crm/checkout/session`
5. backend busca o carrinho persistido
6. backend recalcula e monta `line_items`
7. backend cria a `Checkout Session` na Stripe
8. frontend redireciona para a `url` retornada pela Stripe
9. Stripe envia evento para `POST /api/stripe/webhook`
10. backend valida assinatura usando `STRIPE_WEBHOOK_SECRET`
11. backend marca o checkout como `paid` ou `failed` e limpa o carrinho da sessão quando aplicável
12. Stripe retorna para `/shop-gears/success`
13. página de sucesso tenta confirmar o `session_id` diretamente com a Stripe
14. frontend chama `POST /api/crm/checkout/finalize`
15. backend confirma o pagamento com Stripe antes de criar qualquer pedido no Zoho
16. backend cria ou reutiliza o `Sales_Orders` de Shop Gears no Zoho usando o snapshot confiável do carrinho
17. backend salva dados do pedido criado no status do checkout
18. backend limpa carrinho e marca checkout como `paid_finalized`
19. frontend troca o Lottie de `PROCESSING PAYMENT` para aprovado somente depois do pedido Zoho existir
20. ao abrir a mesma trip novamente, `GET /api/crm/checkout/status` limpa o estado `paid_finalized`, liberando um novo pedido

### Endpoints

- `POST /api/crm/checkout/session`
- `POST /api/crm/checkout/sales-order/dry-run`
- `GET /api/crm/checkout/status?tripId=...`
- `POST /api/crm/checkout/finalize`
- `POST /api/stripe/webhook`

Request:

```json
{
  "tripId": "6623..."
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "id": "cs_test_...",
    "url": "https://checkout.stripe.com/c/pay/cs_test_..."
  }
}
```

### Webhooks

- `POST /api/stripe/webhook`

Eventos tratados:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Regras:

- validar `Stripe-Signature`
- usar o corpo bruto da requisição
- nunca confiar só no redirect do frontend
- se o webhook ainda não tiver chegado, a página de sucesso pode confirmar o `session_id` no servidor usando a API da Stripe

### Zoho Sales Order mapping

Metadata verificada pela API do Zoho CRM em 2026-05-24:

- `Sales_Orders` retornou status `200` e `44` campos
- `Ordered_Items` retornou status `200` e `15` campos
- layout `Product Orders` ativo com id `6623116000003296011`
- campo `Stripe_Currency` confirmado como `text`
- teste controlado de `POST /crm/v8/Sales_Orders` com payload vazio retornou `MANDATORY_NOT_FOUND` para `Ordered_Items`, confirmando acesso de criação sem gravar pedido real
- teste controlado com `Layout`, `Stripe_Currency`, `Shop_Gears_Order` e `Stripe_Checkout_Session_ID` também retornou apenas `MANDATORY_NOT_FOUND` para `Ordered_Items`, confirmando que os novos campos são aceitos pela API

Campos obrigatórios do módulo `Sales_Orders`:

- `Subject` (`text`, obrigatório)
- `Ordered_Items` (`subform`, obrigatório)

Campos customizados criados e confirmados na API:

| Campo | API name | Tipo Zoho | JSON | Uso previsto |
| --- | --- | --- | --- | --- |
| App Order Created At | `App_Order_Created_At` | `datetime` | `string` | data/hora em que o app criou o pedido no Zoho |
| App Order Status | `App_Order_Status` | `picklist` | `string` | estado interno do fluxo do app |
| Parent Trip ID | `Parent_Trip_ID` | `text` | `string` | id da trip/Sales Order original que gerou o pedido de Shop Gears |
| Shop Gears Order | `Shop_Gears_Order` | `boolean` | `boolean` | marca pedidos criados pelo fluxo Shop Gears |
| Stripe Amount Total | `Stripe_Amount_Total` | `currency` | `double` | total pago confirmado pela Stripe |
| Stripe Checkout Session ID | `Stripe_Checkout_Session_ID` | `text` | `string` | id `cs_...` usado para auditoria e prevenção de duplicidade |
| Stripe Currency | `Stripe_Currency` | `text` | `string` | moeda retornada pela Stripe, como `usd` |
| Stripe Payment Intent ID | `Stripe_Payment_Intent_ID` | `text` | `string` | id `pi_...` retornado pela Stripe |
| Stripe Payment Status | `Stripe_Payment_Status` | `picklist` | `string` | status de pagamento vindo da Stripe |

Valores de picklist confirmados:

- `Stripe_Payment_Status`: `paid`, `unpaid`, `processing`, `failed`, `refunded`
- `App_Order_Status`: `processing`, `zoho_created`, `failed`, `refunded`
- `Payment_Terms`: usar `Credit card`
- `Status`: para pedidos de Shop Gears pagos, usar `Completed` inicialmente, salvo decisão operacional diferente

Campos principais do payload de criação do `Sales_Orders`:

```js
{
  Subject: "Shop Gears - <trip/destination name>",
  Deal_Name: { id: "<dealId>" },
  Account_Name: { id: "<travelerAccountId>" },
  Status: "Completed",
  Payment_Terms: "Credit card",
  Parent_Trip_ID: "<originalTripSalesOrderId>",
  Shop_Gears_Order: true,
  App_Order_Status: "zoho_created",
  App_Order_Created_At: "<ISO datetime>",
  Stripe_Checkout_Session_ID: "<cs_...>",
  Stripe_Payment_Intent_ID: "<pi_...>",
  Stripe_Payment_Status: "paid",
  Stripe_Amount_Total: 123.45,
  Stripe_Currency: "usd",
  Ordered_Items: [
    {
      Product_Name: { id: "<productId>" },
      Quantity: 2,
      List_Price: 24.5,
      Discount: 0,
      Tax: 0,
      Description: "SKU: <productCode> | Brand: <vendorName>"
    }
  ]
}
```

Campos do subform `Ordered_Items` que devem ser enviados:

- `Product_Name`: lookup obrigatório para `Products`
- `Quantity`: quantidade do item no carrinho
- `List_Price`: preço unitário confiável recalculado pelo backend
- `Discount`: `0` enquanto não houver regra de desconto
- `Tax`: `0` enquanto não houver regra de imposto
- `Description`: texto curto com SKU/brand para suporte operacional

Campos do subform `Ordered_Items` que não devem ser enviados:

- `Parent_Id`
- `Total`
- `Total_After_Discount`
- `Net_Total`
- `Created_Time`
- `Modified_Time`

Esses campos são read-only, fórmula ou controlados pelo Zoho.

Regras para a próxima implementação:

- manter o snapshot do carrinho junto ao `checkoutStatus` no momento de `POST /api/crm/checkout/session`
- criar/reutilizar o `Sales_Orders` apenas depois de Stripe confirmar `payment_status=paid`
- manter criação idempotente usando `Stripe_Checkout_Session_ID`
- só limpar o carrinho e mostrar animação de aprovado depois que o Zoho retornar o pedido criado
- retornar para o frontend pelo menos `salesOrderId`, `salesOrderNumber`, `amountTotal`, `currency` e `items`

Arquivos da implementação:

- `functions/Zoho_api/services/checkout-state.js`
- `functions/Zoho_api/services/zoho.js`
- `functions/Zoho_api/routes/crm.js`
- `functions/Zoho_api/routes/stripe.js`
- `zyba-app/lib/api.ts`
- `zyba-app/app/trips/[id]/shop-gears/success/page.tsx`
- `zyba-app/app/globals.css`

### Dry run do Sales Order

Endpoint seguro para revisar o payload do pedido sem criar registro no Zoho:

- `POST /api/crm/checkout/sales-order/dry-run`

Request:

```json
{
  "tripId": "6623..."
}
```

Comportamento:

- exige sessão autenticada
- lê o carrinho atual da sessão + trip
- recalcula produtos/preços no backend
- monta o payload do layout `Product Orders`
- retorna `createsZohoRecord: false`
- não chama `zohoCreateRecord`
- não limpa o carrinho
- não chama Stripe

Teste CLI realizado em 2026-05-24, sem criação de registro:

- parent trip: `6623116000003137040`
- produto: `6623116000003148502`
- layout retornado: `Product Orders` (`6623116000003296011`)
- subject gerado: `Shop Gears - Eco Fishing Lodge - 6 Full Days Fishing`
- total: `9.99`
- `Ordered_Items[0].Product_Name.id`: `6623116000003148502`
- `Ordered_Items[0].Quantity`: `1`
- `Ordered_Items[0].List_Price`: `9.99`
- `Stripe_Currency`: `usd`
- resultado: `createsZohoRecord: false`

### Correção do erro pós-Stripe em localhost

Data:

- 2026-05-24

Sintoma:

- após retorno da Stripe para `/shop-gears/success`, o app permanecia em erro
- `POST /api/crm/checkout/finalize` retornava `400`

Causas encontradas:

- Zoho recusou `App_Order_Created_At` quando enviado como ISO com milissegundos e `Z`
- carrinho podia ser limpo pelo webhook antes da criação do `Sales_Orders`, deixando o finalize sem `Ordered_Items`

Correções:

- `App_Order_Created_At` passou a usar o formato já aceito pelo Zoho no projeto: `YYYY-MM-DDTHH:mm:ss+00:00`
- webhook Stripe deixou de limpar carrinho; a limpeza acontece somente depois do `Sales_Orders` existir
- `finalize` ganhou fallback para reconstruir o snapshot pelos line items da sessão Stripe usando `GET /checkout/sessions/:id/line_items`

Teste:

- sessão Stripe paga: `cs_test_a1zKjnuf2jpqoIRhBTZraVCgwqliq230yKwcijOQZfzKBE4zZAHl2e5qXX`
- resultado do reprocessamento: `200 OK`
- `Sales_Orders` criado: `6623116000003302005`
- total: `19.98`
- item: produto `6623116000003148502`, quantidade `2`, unit price `9.99`

### Dependências

Nesta etapa, a integração Stripe foi implementada sem SDK adicional no projeto:

- backend usa chamada HTTPS direta para `api.stripe.com`

Variáveis de ambiente necessárias:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Regras de segurança

- app e backend não capturam dados de cartão
- pagamento acontece somente na página hospedada da Stripe
- o frontend não define preços finais
- `line_items` são montados a partir do carrinho persistido no backend
- confirmação real do pagamento depende do webhook

### Exemplo de uso

Frontend:

- abrir `My Tackle Box`
- clicar `PAY NOW`
- se o webhook for recebido, o status do checkout passa para `paid`
- aguardar redirecionamento para Stripe Checkout

---

## Erros corrigidos

### 1. Filtro de layout retornando zero produtos

Data:

- 2026-04-29

Causa:

- o layout anterior foi tratado com um nome divergente do Zoho
- além disso, o campo `Layout` volta como objeto, não como string simples

Solução:

- removido o filtro padrão fixo por layout
- criado `mapLayout(...)` para normalizar o campo
- produtos passaram a ser separados por `Category`

Arquivos:

- `functions/Zoho_api/services/zoho.js`

---

### 2. `Destination_Related` não filtrava corretamente

Data:

- 2026-04-29

Causa:

- o campo `Destination_Related` no payload completo do Zoho vem aninhado em:
  - `item.Destination_Related`
- a leitura inicial tratava esse campo como lookup simples
- `zohoListRecords(...)` não trazia informação suficiente para esse filtro

Solução:

- parser ajustado para mapear `item.Destination_Related`
- quando existe filtro por destino, os records são hidratados com `zohoGetRecord(...)`
- filtro final passou a funcionar por `destinationRelatedId`

Arquivos:

- `functions/Zoho_api/services/zoho.js`
- `functions/Zoho_api/routes/crm.js`

---

### 3. Hydration mismatch no ícone de carrinho do topbar

Data:

- 2026-04-29

Causa:

- o badge do carrinho dependia de dados do `localStorage`
- o servidor renderizava HTML inicial sem esse valor real do cliente
- o cliente hidratava com contagem diferente

Solução:

- o hook do carrinho foi migrado para `useSyncExternalStore`
- o snapshot de servidor passou a usar referência estável vazia

Arquivos:

- `zyba-app/lib/shop-cart.ts`

---

### 4. `The result of getServerSnapshot should be cached to avoid an infinite loop`

Data:

- 2026-04-29

Causa:

- o `getServerSnapshot` do `useSyncExternalStore` usava array vazio novo a cada render
- isso quebrava a expectativa de referência estável do React

Solução:

- criado `EMPTY_CART` como referência estável compartilhada
- `getServerSnapshot` passou a devolver `EMPTY_CART`

Arquivos:

- `zyba-app/lib/shop-cart.ts`

---

### 5. `The result of getSnapshot should be cached to avoid an infinite loop`

Data:

- 2026-04-29

Causa:

- `readShopCart(...)` fazia `JSON.parse(...)` e gerava novo array a cada leitura
- `useSyncExternalStore` exige snapshot estável quando o store não mudou

Solução:

- criado cache interno de snapshot por `tripId`
- o hook reutiliza a mesma referência quando o conteúdo bruto do `localStorage` não mudou

Arquivos:

- `zyba-app/lib/shop-cart.ts`

---

### 6. `Maximum update depth exceeded`

Data:

- 2026-04-29

Causa:

- consequência do snapshot instável no hook do carrinho
- o React entendia que o estado externo mudava continuamente e disparava re-render em loop

Solução:

- estabilização completa do snapshot do carrinho
- cache por conteúdo bruto do `localStorage`

Arquivos:

- `zyba-app/lib/shop-cart.ts`

---

### 7. `Failed to add cart item`

Data:

- 2026-04-30

Causa:

- o novo carrinho persistido no backend dependia do `cache segment` da função
- no ambiente local essa camada pode falhar ou não responder de forma estável durante escrita/leitura
- quando isso acontecia, a adição ao carrinho quebrava no backend e a UI mostrava `Failed to add cart item`

Solução:

- adicionado fallback em memória no serviço de carrinho quando `cache segment` não estiver disponível
- a persistência principal continua no backend, mas o fluxo local ficou resiliente para desenvolvimento
- melhorada a propagação da mensagem de erro na rota para não esconder a causa real

Arquivos:

- `functions/Zoho_api/services/cart.js`
- `functions/Zoho_api/routes/crm.js`

---

### 8. `Many requests fired in concurrent than the allowed limit`

Data:

- 2026-04-30

Causa:

- o carrinho persistido no backend podia disparar múltiplas chamadas muito próximas entre si
- isso acontecia principalmente na sincronização inicial e em interações rápidas de quantidade/adição
- o backend/cache do ambiente local não tolerava bem essa concorrência

Solução:

- deduplicado o `syncShopCart(...)` por `tripId`
- serializadas as mutações do carrinho por `tripId` no frontend
- com isso, leituras e escritas deixam de competir ao mesmo tempo pela mesma chave do carrinho

Arquivos:

- `zyba-app/lib/shop-cart.ts`

---

### 9. Item adicionado some ao abrir o carrinho

Data:

- 2026-04-30

Causa:

- quando a persistência principal do carrinho falhava no `cache segment`, o backend gravava no fallback em memória
- porém a leitura seguinte podia consultar o `cache segment`, receber vazio sem erro e retornar carrinho vazio
- isso fazia o item aparecer logo após `ADD TO CART`, mas sumir ao abrir o carrinho

Solução:

- a leitura do carrinho passou a consultar também o espelho em memória quando o `cache segment` volta vazio
- a escrita agora mantém sempre o espelho em memória sincronizado, mesmo quando a gravação principal funciona
- a correção foi validada com teste reproduzindo falha de leitura e escrita do storage principal

Arquivos:

- `functions/Zoho_api/services/cart.js`

---

### 10. Carrinho bloqueado ao voltar para a mesma trip após pagamento concluído

Data:

- 2026-05-01

Causa:

- o status de checkout era persistido por `tripId`
- após o pagamento concluído, o backend preservava `paid_finalized` para a futura etapa de `Sales Order`
- ao voltar para a mesma trip, a UI tratava esse status antigo como checkout ainda bloqueante

Solução:

- o endpoint `GET /api/crm/checkout/status` agora limpa `paid_finalized` antes de devolver o status
- `POST /api/crm/cart/items` também faz limpeza defensiva desse estado antes de iniciar um novo carrinho
- isso libera um novo ciclo de compra na mesma trip sem manter o lock visual do checkout anterior

Arquivos:

- `functions/Zoho_api/routes/crm.js`

---

### 11. Carrinho antigo reaparecia após logout e novo login

Data:

- 2026-05-20

Causa:

- o logout removia apenas `zyba_session_token` do `localStorage`
- snapshots locais `zyba_shop_cart:*` continuavam salvos no browser
- o backend persistia carrinho por `email + tripId` com TTL longo
- ao entrar em `Shop Gears` depois de novo login, o app podia sincronizar um carrinho antigo do backend ou renderizar um snapshot local antigo

Solução:

- criado `clearAllShopCartSnapshots()` para remover todos os snapshots locais de carrinho
- novo login limpa snapshots locais antes de salvar o novo token de sessão
- logout limpa snapshots locais e chama `/auth/logout` como best-effort
- backend passou a persistir carrinho por chave opaca de sessão + `tripId`
- checkout/Stripe passou a carregar `cartOwnerKey` no metadata para limpar a sessão correta no webhook
- carrinhos antigos por email ficam órfãos até expirar e não são mais lidos por novas sessões

Arquivos:

- `zyba-app/lib/shop-cart.ts`
- `zyba-app/lib/api.ts`
- `zyba-app/app/login/page.tsx`
- `zyba-app/components/LogoutButton.tsx`
- `functions/Zoho_api/services/cart.js`
- `functions/Zoho_api/routes/crm.js`
- `functions/Zoho_api/services/stripe.js`
- `functions/Zoho_api/routes/stripe.js`

---

### 12. Página antiga de detalhe concorria com o novo modal

Data:

- 2026-05-21

Causa:

- o nome do produto no card navegava para `/trips/[id]/shop-gears/[productId]`
- a nova experiência definida para detalhes passou a ser um bottom sheet/modal sobre a lista
- manter rota antiga e modal criava duas experiências diferentes para a mesma ação

Solução:

- nome do produto passou a ser botão que abre o mesmo modal da imagem e do ícone de informação
- removida a página `zyba-app/app/trips/[id]/shop-gears/[productId]/page.tsx`
- documentação atualizada para tratar detalhes apenas como modal

Arquivos:

- `zyba-app/app/trips/[id]/shop-gears/page.tsx`
- `zyba-app/app/trips/[id]/shop-gears/[productId]/page.tsx`
- `zyba-app/app/globals.css`

Ponto de atenção:

- URLs antigas de detalhe individual passam a retornar 404. Caso seja necessário preservar compatibilidade com bookmarks ou histórico, criar uma estratégia explícita de redirect para a lista ou implementar deep link que abra o modal por query string.

---

### 13. Menu de categorias precisava refletir o Pick List do CRM

Data:

- 2026-05-21

Causa:

- categorias eram derivadas apenas dos produtos carregados
- isso escondia categorias válidas sem produto naquele destino e podia mostrar valores vazios do CRM
- o campo `Category` do módulo `Products` é Pick List e deve ser a fonte do menu

Solução:

- criado endpoint `GET /api/crm/products/categories`
- backend lê metadata de fields do módulo `Products` e normaliza `displayValue` e `actualValue`
- frontend mostra `displayValue` e filtra usando `actualValue`
- opções vazias, `None` e `-None-` são removidas
- se o metadata do CRM falhar, a UI faz fallback para categorias presentes nos produtos carregados

Arquivos:

- `functions/Zoho_api/services/zoho.js`
- `functions/Zoho_api/routes/crm.js`
- `zyba-app/app/trips/[id]/shop-gears/page.tsx`

Ponto de atenção:

- se o label exibido no Pick List mudar mas o `actual_value` permanecer antigo, o filtro continua usando `actualValue`. Antes de mudar valores no CRM, conferir se os produtos existentes usam o mesmo valor real salvo no campo.

---

### 14. Carrinho redesenhado como `My Tackle Box`

Data:

- 2026-05-21

Causa:

- a tela antiga era funcional, mas não seguia o layout desejado de checkout mobile
- havia opção de limpar carrinho completo, removida por decisão de produto
- o campo `Order notes` foi testado e depois removido do fluxo

Solução:

- página do carrinho redesenhada com:
  - título `My Tackle Box`
  - card de produtos
  - subtotal, discount, shipping e total
  - botão `PAY NOW` com cadeado
  - botão secundário `CONTINUE SHOPPING`
  - botão `REMOVE` por item com ícone de lixeira
  - seletor de quantidade no mesmo estilo da página de produtos
- removido `Clear cart` da UI
- removido `Order notes` da UI, do payload de checkout e da metadata Stripe
- `PAY NOW` usa o mesmo padrão visual de loading do `AddTackleButton`, preenchendo com laranja mais escuro

Arquivos:

- `zyba-app/app/trips/[id]/shop-gears/cart/page.tsx`
- `zyba-app/app/globals.css`
- `zyba-app/lib/api.ts`
- `functions/Zoho_api/routes/crm.js`
- `functions/Zoho_api/services/stripe.js`

Ponto de atenção:

- `Discount` e `Shipping` hoje são valores fixos na UI (`0` e `FREE`). Se forem virar regra real de negócio, esses valores devem vir do backend/Stripe e não ser calculados apenas no frontend.

---

### 15. Página `Your Orders`

Data:

- 2026-05-25

Causa:

- após a criação de pedidos de Shop Gears no layout `Product Orders`, o app precisava listar as compras do cliente e permitir abrir os itens comprados
- o usuário também precisava baixar o PDF do Sales Order diretamente pela tela de pedidos

Solução:

- criada/ajustada a tela `/orders` com:
  - título `Your Orders`
  - subtítulo de histórico
  - cards de pedido com `Status`, número do pedido, destino, data de pagamento e total
  - badge de status com variação visual para `Completed`
  - ação circular para download do PDF do Sales Order
  - card expansível para exibir os produtos comprados, quantidade, preço unitário e total
- a rota `GET /crm/orders` agora retorna também:
  - `destinationName`
  - `paymentDate`
  - `items` do subform `Ordered_Items`
- criada rota `GET /crm/orders/:id/pdf`, validando que o pedido pertence ao usuário logado antes de gerar o PDF
- template de impressão usado no download:
  - nome correto: `Product Order`
  - ID validado no Zoho: `6623116000003296412`
  - a rota resolve automaticamente pelo nome `Product Order`
  - `PRODUCT_ORDER_TEMPLATE_ID` pode sobrescrever o ID, se necessário
- observação sobre o ID `6623116000000522759`:
  - esse ID é a pasta `Public Templates`, não o template PDF

Arquivos:

- `zyba-app/app/orders/page.tsx`
- `zyba-app/app/globals.css`
- `zyba-app/lib/api.ts`
- `functions/Zoho_api/routes/crm.js`
- `functions/Zoho_api/services/zoho.js`

Ponto de atenção:

- `paymentDate` usa `App_Order_Created_At` como data de referência do pagamento/pedido aprovado. Se o Zoho passar a receber uma data oficial do Stripe separada, a tela deve priorizar esse novo campo.
- o PDF depende de um template de impressão do Zoho, não do ID do layout nem da pasta. Se o nome `Product Order` mudar no Zoho, atualizar `PRODUCT_ORDER_TEMPLATE_NAME` ou `PRODUCT_ORDER_TEMPLATE_ID`.

---

## Próximas etapas recomendadas

1. validar em produção o download do PDF do Product Order após deploy da rota `/crm/orders/:id/pdf`
2. decidir regra de expiração/limpeza administrativa para carrinhos órfãos antigos
3. criar mecanismo explícito de refresh de catálogo caso seja necessário ignorar temporariamente o cache de `Products`
4. decidir compatibilidade para URLs antigas de detalhe de produto, caso usuários tenham links salvos
5. se novas informações entrarem no modal de detalhes, garantir que elas estejam no payload da lista de produtos ou criar carregamento sob demanda no modal
6. mover `Discount` e `Shipping` para cálculo backend quando deixarem de ser valores fixos

---

## Regra de manutenção

Sempre que um erro do fluxo `Shop Gears` for corrigido, adicionar nova entrada em:

- `## Erros corrigidos`

Cada entrada deve conter:

- data
- causa
- solução
- arquivos alterados
