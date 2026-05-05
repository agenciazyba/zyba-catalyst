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
- página de detalhe `Gears Details`
- carrinho persistido no backend por `session + tripId`
- cache local do carrinho no app por `tripId`
- resumo de carrinho no topo e navegação para `Cart`

Arquivos principais:

- `functions/Zoho_api/services/zoho.js`
- `functions/Zoho_api/routes/crm.js`
- `zyba-app/lib/shop-cart.ts`
- `zyba-app/app/trips/[id]/shop-gears/page.tsx`
- `zyba-app/app/trips/[id]/shop-gears/[productId]/page.tsx`
- `zyba-app/app/trips/[id]/shop-gears/cart/page.tsx`
- `zyba-app/components/AppTopBar.tsx`
- `zyba-app/app/globals.css`

---

## Arquitetura resumida

### Backend

Rotas principais:

- `GET /api/crm/products`
- `GET /api/crm/products/:productId`
- `GET /api/crm/cart`
- `POST /api/crm/cart/items`
- `PATCH /api/crm/cart/items/:productId`
- `DELETE /api/crm/cart/items/:productId`
- `DELETE /api/crm/cart`

Origem dos dados:

- módulo Zoho: `Products`
- layout validado: `Lures and Flies`

Campos usados:

- `Color`
- `Description`
- `Record_Image`
- `Destination_Related`
- `Layout`
- `Product_Active`
- `Product_Code`
- `Lure_Image_Catalog`
- `Lure_Image_Real`
- `Product_Name`
- `Unit_Price`
- `Vendor_Name`

### Frontend

Páginas:

- `Shop Gears`:
  - lista de produtos
  - quantidade
  - `ADD TO CART`
- `Gears Details`:
  - carrossel de imagens
  - nome
  - código
  - brand
  - preço
  - quantidade
  - `ADD TO CART`
- `Cart`:
  - itens adicionados
  - ajuste de quantidade
  - remoção
  - subtotal

Persistência atual:

- fonte de verdade do carrinho no backend da função `Zoho_api`
- persistência em cache segmentado da função por `session + tripId`
- `localStorage` mantido no frontend apenas como snapshot/cache de render
- sincronização automática do carrinho ao abrir as páginas de `Shop Gears`

---

## Cache

### Padrão adotado no projeto

O frontend autenticado usa `fetch` com `cache: "no-store"` e a economia de chamadas acontece no backend.

### Shop Gears

Cache backend aplicado em `functions/Zoho_api/services/zoho.js`:

- `TTL_PRODUCTS_MS`
- cache da lista de products por combinação de filtros
- cache do detalhe por `productId + layout`

Objetivo:

- reduzir chamadas repetidas ao Zoho
- manter o mesmo padrão das demais áreas do app

---

## UI e microinteractions

### Atualizações recentes

Data:

- 2026-05-04

Melhorias aplicadas:

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
- página `Gears Details` foi simplificada para começar direto no conteúdo do produto
- miniaturas de produto na lista e no carrinho passaram a usar `object-fit: contain`
- card da imagem na página de detalhe do produto passou a usar fundo branco

Arquivos principais:

- `zyba-app/app/trips/[id]/shop-gears/page.tsx`
- `zyba-app/app/trips/[id]/shop-gears/[productId]/page.tsx`
- `zyba-app/app/trips/[id]/shop-gears/cart/page.tsx`
- `zyba-app/components/AppTopBar.tsx`
- `zyba-app/lib/shop-cart.ts`
- `zyba-app/app/globals.css`

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
- preservação do status final do checkout para a futura etapa de `Sales Order`

Ainda pendente:

- criação do `Sales Order` no Zoho após pagamento confirmado

### Fluxo do checkout

1. usuário monta o carrinho em `Shop Gears`
2. carrinho persistido no backend por `session + tripId`
3. usuário abre `Your Tackle Box`
4. ao clicar em `PAY NOW`, o app chama `POST /api/crm/checkout/session`
5. backend busca o carrinho persistido
6. backend recalcula e monta `line_items`
7. backend cria a `Checkout Session` na Stripe
8. frontend redireciona para a `url` retornada pela Stripe
9. Stripe envia evento para `POST /api/stripe/webhook`
10. backend valida assinatura usando `STRIPE_WEBHOOK_SECRET`
11. backend marca o checkout como `paid` ou `failed`
12. Stripe retorna para `/shop-gears/success`
13. página de sucesso tenta confirmar o `session_id` diretamente com a Stripe
14. frontend chama `POST /api/crm/checkout/finalize`
15. backend limpa carrinho e marca checkout como `paid_finalized`
16. ao abrir a mesma trip novamente, `GET /api/crm/checkout/status` limpa o estado `paid_finalized`, liberando um novo pedido

### Endpoints

- `POST /api/crm/checkout/session`
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

- abrir `Your Tackle Box`
- clicar `PAY NOW`
- se o webhook for recebido, o status do checkout passa para `paid`
- aguardar redirecionamento para Stripe Checkout

---

## Erros corrigidos

### 1. Filtro de layout retornando zero produtos

Data:

- 2026-04-29

Causa:

- o layout foi inicialmente tratado como `Lure and Flies`
- no Zoho o nome real validado é `Lures and Flies`
- além disso, o campo `Layout` volta como objeto, não como string simples

Solução:

- corrigido o nome padrão do layout para `Lures and Flies`
- criado `mapLayout(...)` para normalizar o campo
- removida a dependência de filtro COQL inválido por `Layout`

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
- isso fazia o item aparecer logo após `ADD TO CART`, mas sumir ao abrir `Your Tackle Box`

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

## Próximas etapas recomendadas

1. criar `POST /api/crm/checkout/session`
2. redirecionar `PAY NOW` para Stripe Checkout
3. criar `POST /api/stripe/webhook`
4. criar `Sales Order` no Zoho somente após aprovação no webhook do Stripe

---

## Regra de manutenção

Sempre que um erro do fluxo `Shop Gears` for corrigido, adicionar nova entrada em:

- `## Erros corrigidos`

Cada entrada deve conter:

- data
- causa
- solução
- arquivos alterados
