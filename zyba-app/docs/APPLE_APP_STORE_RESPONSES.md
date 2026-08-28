# Apple App Store Connect Responses

Documento operacional para manter consistentes as respostas do Zyba Outdoors no Apple Developer / App Store Connect.

Use este arquivo antes de publicar novas funcionalidades. Se uma feature nova mudar coleta de dados, conteúdo exibido, login, compras, mídia, mensagens, comunidade, analytics, anúncios ou permissões, revise as respostas da Apple antes de enviar uma nova versão.

Ultima atualização: 2026-08-25

## Fontes Oficiais

- App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Manage App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Set an App Age Rating: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating
- App Store Categories: https://developer.apple.com/app-store/categories/
- Platform Version Information: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information

## Respostas Atuais da Versão 1.0

### Informações do App

| Campo | Resposta usada |
| --- | --- |
| Nome | Zyba Outdoors |
| Subtítulo | Fishing Travel Manager app |
| Categoria primária | Viagem / Travel |
| Categoria secundária | Esportes / Sports |
| Preço | USD 0.00 |
| Direitos de conteúdo | Sim, este app contém, exibe ou acessa conteúdo de terceiros, e temos os direitos necessários |
| URL da política de privacidade | https://www.zybaoutdoors.com/privacy-policy |

Motivo para direitos de conteúdo: o app pode exibir destinos, imagens, textos, fornecedores, operadores, produtos, roteiros e mídia de parceiros ou terceiros autorizados. Manter evidência interna de autorização/licença quando conteúdo de parceiro for usado.

### App Review

| Campo | Resposta usada |
| --- | --- |
| Login obrigatório | Sim |
| Caminho recomendado para revisão | Abrir o app normalmente ou acessar https://zyba-catalyst.vercel.app/login |
| Rota técnica de revisão | `/auth/apple-review/login` no backend Catalyst. A rota frontend `/apple-review-login` permanece como fallback técnico, mas nao deve ser a instrução principal para App Review |
| Tipo de login dos clientes | OTP |
| Usuário Apple Review | apple@zybaoutdoors.com |
| Senha Apple Review | Nao documentar senha neste arquivo. Manter apenas no App Store Connect e no gerenciador seguro usado pela equipe |
| Observação para revisão | Informar que o revisor deve usar a tela normal de sign in. Ao digitar `apple@zybaoutdoors.com`, o campo de senha aparece e fornece acesso completo de teste sem alterar o login OTP dos clientes |

Nunca commitar senhas, tokens, chaves Stripe, Zoho refresh token ou secrets da Apple Review.

### Atualização de Login Apple Review - 2026-08-25

Motivo: a Apple recusou a submissão informando que nao conseguiu acessar o app com as credenciais de demonstração. O build iOS abre o domínio principal do app, que leva à tela normal de login por OTP. A rota escondida `/apple-review-login` existia e funcionava, mas nao estava no caminho que o revisor via ao abrir o app.

Alteração aplicada no frontend:

- Arquivo: `zyba-app/app/login/page.tsx`
- Commit: `322c405 Allow Apple review login from main sign in`
- Comportamento novo: quando o e-mail `apple@zybaoutdoors.com` é digitado na tela normal de login, a tela exibe campo `Password` e chama `POST /auth/apple-review/login`.
- Comportamento preservado: qualquer outro e-mail continua no fluxo OTP padrão.
- Segurança: a senha nao foi adicionada ao código. Ela continua configurada no Catalyst via `APPLE_REVIEW_LOGIN_PASSWORD` e informada apenas no App Store Connect / gerenciador seguro da equipe.

Texto recomendado para App Review Notes:

```txt
Use the normal sign-in screen in the app.

Username: apple@zybaoutdoors.com
Password: [same password provided in App Store Connect]

After entering the username, the password field will appear. This account provides access to Trips, Profile, Documents, Itinerary, Flights, Hotels, Transfer Information, Shop Gears, Cart, and Orders.
```

### Classificação Etária

| Pergunta | Resposta recomendada para o app atual |
| --- | --- |
| Feito para crianças | Nao aplicavel |
| Redes sociais / social networking | Nao, enquanto o app nao tiver perfil publico, feed, amigos, comentarios publicos, mensagens entre usuarios, postagem de conteudo por usuarios ou compartilhamento social dentro do app |

Se futuras funcionalidades adicionarem chat entre clientes, feed, comentarios, reviews publicas, perfis publicos, grupos, posts, upload publico de fotos/videos ou qualquer interacao usuario-usuario, revisar a classificação etária antes de publicar.

## Privacidade do App

As respostas de privacidade devem representar o que o app e parceiros terceirizados coletam. A Apple exige que as respostas sejam publicadas por uma conta com papel Account Holder, Admin ou App Manager.

### Tipos de Dados Base do App Atual

Declarar somente os tipos realmente coletados. Para a versão 1.0, a base esperada é:

| Tipo de dado Apple | Quando declarar | Finalidade padrao | Vinculado ao usuario? | Rastreamento? |
| --- | --- | --- | --- | --- |
| Nome | Nome do cliente/viajante em perfil, viagem, pedido ou suporte | Funcionalidade do app | Sim | Nao |
| Endereço de e-mail | Login, OTP, suporte, conta ou contato operacional | Funcionalidade do app | Sim | Nao |
| Número de telefone | Contato operacional, suporte ou dados do viajante | Funcionalidade do app | Sim | Nao |
| ID de usuário | Account ID, Zoho account ID, customer ID ou session/account identifier | Funcionalidade do app | Sim | Nao |
| Histórico de compras | Pedidos, shop gears, checkout, reservas ou compras associadas ao cliente | Funcionalidade do app | Sim | Nao |
| Suporte ao cliente | Mensagens e dados enviados pelo usuario para atendimento | Funcionalidade do app | Sim | Nao |
| Dados de pagamento | Declarar se o app, backend ou parceiros recebem/armazenam dados de pagamento identificaveis | Funcionalidade do app | Sim, se associado ao cliente | Nao |

Observação importante sobre Stripe: segundo a Apple, se o pagamento é inserido fora do app em um provedor de pagamento e o desenvolvedor nunca tem acesso aos dados de pagamento, pode nao ser necessario declarar Payment Info. No Zyba, revisar a implementação antes de responder, porque Stripe Checkout pode gerar eventos, status e historico de compra mesmo sem armazenar cartao completo no app.

### Resposta Detalhada por Tipo de Dado

Para cada tipo listado acima, usar como padrão:

- Finalidade: Funcionalidade do app.
- Vinculado à identidade do usuário: Sim.
- Usado para rastreamento: Nao.

Nao marcar publicidade, marketing, analise ou personalização do produto, a menos que a funcionalidade nova realmente use esse dado para essa finalidade.

## O Que Conta Como Rastreamento

Para a Apple, rastreamento envolve vincular dados coletados no app com dados de terceiros para publicidade direcionada, medição de publicidade ou compartilhar dados com corretor de dados.

No app atual, manter resposta "Nao usamos para rastreamento" se:

- Nao houver rede de publicidade.
- Nao houver SDK que reutilize dados para publicidade de terceiros.
- Nao houver compartilhamento de lista de e-mails, IDs ou perfis com rede de anuncios.
- Nao houver data broker.
- Nao houver cruzamento com dados de apps/sites de terceiros para publicidade.

Se qualquer item acima for adicionado, revisar App Privacy, ATT/App Tracking Transparency e política de privacidade antes de publicar.

## Checklist Antes de Publicar Nova Feature

Antes de merge, deploy ou envio para TestFlight/App Review, responder:

1. A feature coleta novo dado pessoal?
2. A feature envia novo dado para backend, Zoho, Stripe, Vercel, analytics, CRM, suporte ou outro provedor?
3. A feature adiciona analytics de comportamento, funil, cliques, sessão ou métricas por usuário?
4. A feature adiciona push notification, e-mail marketing, campanhas ou remarketing?
5. A feature adiciona upload de foto, vídeo, documento, audio, texto livre ou anexo?
6. A feature exibe conteúdo de parceiros, marcas, operadores, mídia licenciada ou terceiros?
7. A feature permite interação entre usuários, comentários, chat, perfil público, feed, reviews públicas ou compartilhamento social?
8. A feature altera compras, checkout, reembolso, carrinho, produtos ou histórico de pedidos?
9. A feature exige nova permissão iOS, como câmera, fotos, localização, contatos, notificações ou microfone?
10. A feature muda login, rota Apple Review, OTP, sessão ou dados do usuário de teste da Apple?

Se qualquer resposta for "sim", atualizar este documento e revisar App Store Connect antes de publicar.

## Matriz de Impacto por Funcionalidade

| Funcionalidade nova | Provável impacto Apple |
| --- | --- |
| Chat entre cliente e suporte | Pode afetar Customer Support; se for usuario-usuario, revisar social networking e idade |
| Chat entre clientes | Revisar social networking, moderação, UGC, idade e privacidade |
| Upload de foto/video | Declarar Photos or Videos se coletado; revisar permissões e conteúdo de usuário |
| Review publica de destinos | Revisar social networking, UGC, moderação, idade e privacidade |
| Analytics de cliques ou sessão por usuário | Pode declarar Product Interaction e Analytics; revisar vinculação |
| Push notifications | Revisar texto de permissão, marketing vs funcionalidade |
| Cupons ou campanhas personalizadas | Pode virar marketing ou personalização do produto |
| Recomendações personalizadas de produtos/viagens | Pode marcar Personalização do produto |
| Ads ou pixels de remarketing | Pode marcar Tracking e exigir ATT |
| Novo gateway de pagamento | Revisar Payment Info, Purchase History, privacy policy e termos |
| Login social | Revisar terceiros, dados coletados, tracking por SDK e política |
| Localização | Declarar localização se enviada/armazenada fora do dispositivo |

## Regras Internas de Segurança

- Nao commitar credenciais Apple Review.
- Nao commitar `.env`, Stripe secrets, Zoho tokens, refresh tokens ou webhook secrets.
- Manter o endpoint de Apple Review separado do fluxo OTP dos clientes. A tela normal de login pode exibir senha somente para o e-mail Apple Review configurado.
- Validar produção antes de enviar para revisão: login Apple Review, OTP cliente, trips, documents, itinerary, shop gears, checkout cancel/success.
- Evitar deploy de backend diretamente do repo se `catalyst-config.json` local contiver variáveis vazias.
- Sempre confirmar que a política de privacidade pública está acessível com HTTP 200.

## Processo Recomendado Antes de Enviar para App Review

1. Revisar checklist de privacidade e idade neste documento.
2. Rodar build local do app.
3. Validar URL pública da política de privacidade.
4. Validar login Apple Review em produção pela tela normal de login: abrir `/login`, digitar `apple@zybaoutdoors.com`, confirmar que o campo de senha aparece e que o app entra em `/trips`.
5. Validar que variáveis Production de Vercel, Catalyst, Stripe e Zoho estão corretas.
6. Conferir App Store Connect: categoria, direitos de conteúdo, privacidade publicada, classificação etária, screenshots e build selecionada.
7. Se houver alteração de privacidade, publicar respostas em App Privacy antes de clicar em "Adicionar para revisão".
8. Enviar para revisão e congelar mudanças sensíveis até a Apple concluir.
