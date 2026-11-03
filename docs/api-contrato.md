# Contrato da API — Aquece Lar

Este documento descreve o que o frontend espera da API. Hoje o front funciona com mocks em memória: cada tela chama uma função em `src/services/`, e cada uma dessas funções vai virar uma chamada HTTP **com a mesma assinatura**. Os tipos citados aqui estão em `src/types/`.

O objetivo é que a API devolva os dados no formato abaixo para que a troca seja só dentro de `src/services/`, sem mexer nas telas. Onde o front de hoje faz algo que deveria ser da API, isso está na seção [Pontos para decidir](#pontos-para-decidir).

## Convenções

- **JSON em camelCase**, com os mesmos nomes de campo dos tipos do front.
- **Datas:** dia como `AAAA-MM-DD`; data/hora como ISO 8601 com fuso (`2026-10-30T09:42:00-03:00`). O fuso de referência do negócio é `America/Sao_Paulo`: o filtro por período usa o dia local da criação.
- **Dinheiro:** número em reais com até 2 casas (`3600.5`). A API pode guardar em centavos ou decimal, mas deve devolver assim.
- **IDs:** string. Gerados pela API (veja [Pontos para decidir](#pontos-para-decidir)).
- **Cancelamento:** o front cancela requisições ao trocar de tela (`AbortSignal` → `fetch(..., { signal })`). Não precisa de nada na API.
- **Erros:** status HTTP + corpo `{ "error": "<codigo>", "message": "<texto para o usuário>" }`. O front mostra `message` quando faz sentido.

| Situação | HTTP | `error` |
|---|---|---|
| Dados inválidos (campo faltando, período inválido) | 400 | `validation` / `invalid_period` |
| Registro não existe | 404 | `not_found` |
| Código de produto já usado | 409 | `duplicate_product_code` |
| Orçamento não pode mais ser editado | 409 | `quote_not_editable` |
| Transição de status não permitida | 409 | `invalid_status_transition` |

## Mapa das funções → endpoints

| Função no front | Endpoint sugerido | Telas |
|---|---|---|
| `login(email, password, remember)` | `POST /auth/login` → `{ email, name, access }` + cookie de sessão HttpOnly; credenciais erradas: 401 `invalid_credentials`. `GET /auth/me` → `{ email, name, access }` (veja [Perfis e permissões](#perfis-e-permissões)); `POST /auth/logout` → 204. Sem sessão, as outras rotas respondem 401 `unauthorized` | Login |
| `listUsers()`, `createUser(draft)`, `updateUser(id, draft)`, `deleteUser(id)` | Só administrador (senão 403 `forbidden`). `GET /users` → `[{ id, name, email, createdAt, lastLoginAt, isCurrent, role, sellerId, sellerName, seeAll, exceedDiscount }]`; `POST /users` `{ name, email, password, role, sellerId, seeAll, exceedDiscount }`; `PUT /users/:id` (senha vazia mantém a atual; senha nova derruba as outras sessões); `DELETE /users/:id`. E-mail repetido: 409 `duplicate_email`; excluir a si mesmo: 409 `cannot_delete_self`; mudar o próprio perfil: 409 `cannot_change_own_role`; tirar o último administrador: 409 `last_admin` | Configurações → Usuários |
| `getDashboard(period)` | `GET /dashboard?from=&to=` | Dashboard |
| `listQuotes(period)` | `GET /quotes?from=&to=` | Lista de orçamentos |
| `getQuote(id)` | `GET /quotes/:id` | Detalhe, editar, duplicar |
| `createQuote(draft, note?)` | `POST /quotes` | Novo, duplicar |
| `updateQuote(id, draft)` | `PUT /quotes/:id` | Editar |
| `updateQuoteStatus(id, status)` | `POST /quotes/:id/status` | Detalhe |
| `listSellers()` / `saveSeller()` / `deleteSeller(id)` | `GET` / `POST`·`PUT` / `DELETE /sellers[/:id]` | Vendedores, orçamento, clientes |
| `listCustomers()` / `saveCustomer()` / `deleteCustomer(id)` | `GET` / `POST`·`PUT` / `DELETE /customers[/:id]` | Clientes, orçamento |
| `listProducts()` / `saveProduct()` / `deleteProduct(id)` | `GET` / `POST`·`PUT` / `DELETE /products[/:id]` | Produtos, orçamento |
| `getSettings()` / `saveSettings(settings)` | `GET` / `PUT /settings` | Configurações, orçamento, PDF |

`save*` hoje cria ou atualiza conforme o id já existir. Na API: `POST` cria (sem id, devolve o registro com id), `PUT /:id` atualiza.

---

## Perfis e permissões

Cada usuário tem um perfil. As regras ficam em `src/lib/access.ts`, usadas pela API (que confere em cada rota) e pelo front (que esconde menus e botões).

```ts
interface Access {
  role: 'Administrador' | 'Gerente' | 'Vendedor';
  sellerId: string | null;   // cadastro de vendedor ligado; obrigatório no perfil Vendedor
  sellerName: string | null;
  seeAll: boolean;           // vendedor: vê orçamentos, clientes e dashboard de todos
  exceedDiscount: boolean;   // vendedor: salva desconto acima de maxDiscountPercent
}
```

| | Administrador | Gerente | Vendedor |
|---|---|---|---|
| Orçamentos (`/quotes`) | todos | todos | só os dele; com `seeAll`, vê todos mas só edita e muda status dos dele |
| Criar orçamento | qualquer vendedor | qualquer vendedor | só no próprio nome (403 `forbidden`) |
| Desconto acima do máximo | sim | sim | só com `exceedDiscount` (403 `discount_over_limit`) |
| Clientes (`/customers`) | todos | todos | só os dele (com `seeAll`, todos); cadastra sempre no próprio nome e só edita os dele; não exclui |
| Vendedores e produtos | edita | edita | só consulta (`GET /sellers` devolve só o próprio cadastro, se não tiver `seeAll`) |
| Dashboard | geral | geral | só os números dele (com `seeAll`, geral) |
| `PUT /settings` e `/users` | sim | 403 | 403 |

- Sem permissão: 403 `forbidden`. Orçamento de outro vendedor, para quem só vê os seus, responde 404 (como se não existisse).
- `GET /settings` continua aberto a todos: o formulário de orçamento usa os padrões.
- Usuários que já existiam viraram administradores na migração, para ninguém perder acesso. Sempre sobra ao menos um administrador, e ninguém muda o próprio perfil.
- Nos dados fictícios há uma conta por perfil (`src/services/mocks/authMock.ts`).

---

## Período

Usado no dashboard e na lista de orçamentos.

```ts
interface Period {
  from: string; // AAAA-MM-DD
  to: string;   // AAAA-MM-DD
}
```

Regras (hoje em `validatePeriod`, em `dashboardService.ts`): as duas datas válidas, `from <= to`, no máximo **366 dias** contando os dois extremos. Fora disso: 400 `invalid_period`.

## Dashboard — `GET /dashboard?from=&to=`

```ts
interface DashboardData {
  kpis: Kpi[];
  daily: DailyPoint[];      // um ponto por dia do período, em ordem
  ranking: SellerRank[];
  recentQuotes: Quote[];    // os 10 mais recentes do período
  expiry: {                 // não depende do período: é a situação de hoje
    alertDays: number;      // settings.quotes.expiryAlertDays
    expiring: Quote[];      // abertos que vencem de hoje até alertDays, por validUntil crescente
    expired: number;        // abertos que já passaram de validUntil
  };
}

interface DailyPoint {
  date: string;      // AAAA-MM-DD
  quantity: number;  // orçamentos criados no dia
  amount: number;    // soma dos valores do dia
  partial: boolean;  // true no dia de hoje (ainda em andamento)
}

interface SellerRank {
  id: string;
  name: string;
  quotes: number;
  amount: number;
  goal: number | null; // meta mensal proporcional ao período; null = sem meta
}
```

Tudo sai dos mesmos orçamentos de `GET /quotes`, para que um orçamento novo apareça no dashboard na hora (a simulação está em `src/services/mocks/dashboardMock.ts`):

- **Total de orçamentos** e **Valor total**: quantidade e soma de `amount` no período, com a variação percentual sobre o período anterior de mesmo tamanho (`"+12%"`, `"-8%"`; `"—"` quando o anterior foi zero).
- **Clientes atendidos**: clientes distintos com orçamento no período, com a diferença absoluta sobre o período anterior (`"+3"`, `"-1"`, `"0"`).
- **Vendedores ativos**: ativos no cadastro, com `"6 de 8"` no lugar da variação.
- **Ranking**: um item por vendedor ativo, com quantidade e soma no período (o front ordena por valor). `goal` é a `monthlyGoal` do vendedor proporcional ao período: cada dia vale 1/(dias do seu mês), então o mês cheio dá a meta inteira e de 1 a 15 de outubro dá 15/31 dela (`prorateMonthly` em `src/services/period.ts`).

O front pinta a variação de vermelho quando começa com `-` e de neutro quando é `0`, `0%` ou `—`. `Kpi` hoje carrega texto pronto e o ícone (veja [Pontos para decidir](#pontos-para-decidir)).

## Orçamentos

### Tipos

```ts
type QuoteStatus = 'Pendente' | 'Enviado' | 'Aprovado' | 'Cancelado';

/** Linha da listagem (lista e dashboard). */
interface Quote {
  id: string;
  number: string;     // "#1182", sequencial, definido pela API
  customer: string;   // nome do cliente
  seller: string;     // nome do vendedor
  amount: number;     // total já com desconto
  status: QuoteStatus;
  createdAt: string;  // data/hora ISO
  validUntil: string; // AAAA-MM-DD; vem também na lista, para o selo de vencimento
}

interface QuoteDetail extends Quote {
  customerInfo: QuoteContact;
  sellerInfo: QuoteContact;
  items: QuoteItem[];
  paymentTerms: string;
  discount: QuoteDiscount | null;
  notes: string;
  history: QuoteEvent[];         // do mais antigo para o mais novo
}

interface QuoteContact {
  name: string;
  detail: string;  // documento do cliente ou e-mail do vendedor
  phone: string;
  city?: string;
}

interface QuoteItem { code: string; description: string; quantity: number; unitPrice: number }

interface QuoteDiscount {
  type: 'percent' | 'amount';
  value: number; // 0–100 se percent; reais se amount
}

interface QuoteEvent {
  status: QuoteStatus; // status do orçamento depois do evento
  at: string;          // data/hora ISO
  note: string;        // texto mostrado na linha do tempo
}

/** Corpo de POST /quotes e PUT /quotes/:id. */
type QuoteDraft = Pick<QuoteDetail,
  'customerInfo' | 'sellerInfo' | 'items' | 'validUntil' | 'paymentTerms' | 'discount' | 'notes'>;
```

`customerInfo` e `sellerInfo` são uma **cópia** dos dados no momento do orçamento: se o cliente mudar de telefone depois, o orçamento antigo continua com o telefone que foi enviado.

### Cálculo do valor

A API deve **calcular** o total, sem confiar no valor enviado. A regra é a de `src/lib/quoteTotals.ts`:

1. `subtotal` = soma de `quantity × unitPrice`, arredondada em centavos.
2. `desconto` = `subtotal × value / 100` (percent) ou `value` (amount), limitado entre 0 e o subtotal, arredondado em centavos.
3. `amount` = `subtotal − desconto`.

Exemplo: 2 × 3.790 + 1 × 650 = 8.230; com 5% → desconto 411,50 → total **7.818,50**.

### Validade e vencimento

Não há status "Vencido": é calculado a partir de `validUntil` (regra em `src/lib/quoteExpiry.ts`).

- Só **Pendente** e **Enviado** vencem (esperam resposta do cliente).
- O orçamento vale até o fim do dia `validUntil`. Depois disso está **vencido**.
- Está **vencendo** quando faltam de 0 a `expiryAlertDays` dias (configurações).
- O front mostra o selo na lista, no detalhe (fora do PDF) e no bloco do dashboard. A API só precisa devolver `validUntil` em `Quote` e o resumo `expiry` do dashboard.

### `GET /quotes?from=&to=`

Orçamentos **criados** no período (pelo dia local de `createdAt`), do mais recente para o mais antigo. Devolve `Quote[]`. A busca, o filtro de status e a paginação (15 por página) são feitos no front hoje; se o volume crescer, dá para levar para a API.

### `GET /quotes/:id`

Devolve `QuoteDetail`. 404 se não existir.

### `POST /quotes`

Corpo: `QuoteDraft`, mais `copiedFromId?: string` quando for uma cópia (tela Duplicar).

A API:

- valida: ao menos 1 item; `quantity` inteiro ≥ 1; `unitPrice` > 0; `validUntil` não anterior a hoje; desconto entre 0 e 100% ou entre 0 e o subtotal;
- define `id`, `number` (próximo da sequência), `status: 'Pendente'`, `createdAt` e `amount`;
- cria o primeiro evento do histórico: `"Orçamento criado"`, ou `"Criado a partir do orçamento #1179"` quando vier `copiedFromId`.

Devolve o `Quote` criado (o front navega para `/orcamentos/:id`).

### `PUT /quotes/:id`

Corpo: `QuoteDraft`. **Só para orçamentos `Pendente`**; nos outros status: 409 `quote_not_editable` (o front oferece duplicar). Recalcula `amount`, atualiza `customer`/`seller` e acrescenta o evento `"Orçamento editado"` (status `Pendente`). Devolve o `Quote` atualizado.

### `POST /quotes/:id/status`

Corpo: `{ "status": QuoteStatus }`. Transições permitidas (as mesmas que a tela de detalhe oferece):

| De | Para | Evento no histórico |
|---|---|---|
| Pendente | Enviado | "Enviado ao cliente" |
| Pendente | Cancelado | "Orçamento cancelado" |
| Enviado | Aprovado | "Aprovado pelo cliente" |
| Enviado | Cancelado | "Orçamento cancelado" |
| Cancelado | Pendente | "Voltou para pendente" (Reabrir) |

`Aprovado` é final. Qualquer outra: 409 `invalid_status_transition`.

**WhatsApp:** o envio pelo WhatsApp deve gerar a transição Pendente → Enviado com o evento `"Enviado ao cliente por WhatsApp"` (texto que os mocks já usam). Uma opção é um endpoint próprio, `POST /quotes/:id/send` com `{ "channel": "whatsapp" }`, que envia e registra a transição.

## Vendedores — `/sellers`

```ts
interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  region: string;
  status: 'Ativo' | 'Inativo';
  quotes: number; // orçamentos no mês corrente (calculado pela API)
  amount: number; // valor orçado no mês corrente (calculado pela API)
  monthlyGoal: number | null; // meta mensal de valor orçado; null = sem meta
}
```

Corpo de criação/edição: `name`, `email`, `phone`, `region`, `status`, `monthlyGoal`. Validação: `name` com 3+ caracteres, `email` válido, `monthlyGoal` nulo ou maior que zero. Só vendedores **ativos** aparecem no orçamento.

## Clientes — `/customers`

```ts
interface Customer {
  id: string;
  name: string;
  kind: 'PF' | 'PJ';
  document: string;           // CPF ou CNPJ como digitado (os mocks usam formatado)
  phone: string;
  city: string;
  seller: string;             // nome do vendedor responsável ('' = nenhum)
  quotes: number;             // total de orçamentos (calculado pela API)
  lastQuoteAt: string | null; // data/hora do último orçamento (calculado pela API)
}
```

Corpo de criação/edição: `name`, `kind`, `document`, `phone`, `city`, `seller`. Validação: `name` com 3+ caracteres; `document` opcional, mas se vier precisa ter 11 dígitos (PF) ou 14 (PJ). O front também cadastra clientes de dentro do formulário de orçamento, usando o mesmo endpoint.

## Produtos — `/products`

```ts
interface Product {
  id: string;
  code: string;        // único, sem diferenciar maiúsculas; guardado em maiúsculas
  description: string;
  category: 'Aquecedores a gás' | 'Boilers' | 'Lareiras' | 'Piscina' | 'Acessórios' | 'Serviços';
  unitPrice: number;   // preço de tabela (o orçamento pode alterar por item)
  status: 'Ativo' | 'Inativo';
  photos: string[];    // fotos em ordem; a primeira é a capa (pode ser vazio)
}
```

Regras:

- `photos`: hoje o front guarda cada foto como data URL (JPEG de até 1280 px). Com o backend, o ideal é um upload (`POST /products/:id/photos`, multipart) que devolve a URL; o `PUT` do produto envia a lista final de URLs na ordem desejada. Limite do front: 8 fotos por produto.
- `code` obrigatório e único (`aqg-20d` conflita com `AQG-20D`): 409 `duplicate_product_code`. `description` com 3+ caracteres; `unitPrice` > 0.
- **Ordem do `GET`:** ativos primeiro, inativos depois. Um produto novo entra no topo; um produto que acabou de ser inativado vai para o fim da lista. Sugestão: ativos por `createdAt` decrescente e inativos por `inactivatedAt` crescente.
- Só produtos **ativos** aparecem na busca do orçamento. Ao editar ou duplicar um orçamento antigo, os itens de produtos inativos ou excluídos continuam aparecendo (o front resolve isso com os dados do próprio item).

---

## Configurações — `/settings`

Um único registro (não é lista): `GET /settings` devolve tudo e `PUT /settings` grava o objeto inteiro e devolve o que ficou salvo.

```ts
interface Settings {
  company: {
    name: string;        // obrigatório
    document: string;    // CNPJ como digitado; vazio se não informado
    phone: string;
    email: string;
    address: string;
    footer: string;      // texto livre no fim do PDF; quebras de linha valem
    logo: string | null; // hoje data URL (PNG de até 480 px)
  };
  quotes: {
    validDays: number;       // inteiro de 1 a 365
    paymentTerms: string[];  // ao menos uma; a primeira é a padrão
    notes: string;
    maxDiscountPercent: number | null; // 0 a 100; null = sem limite
    expiryAlertDays: number;           // inteiro de 0 a 60
  };
}
```

Regras:

- Inválido → 400 `validation` com a mensagem do campo: nome vazio, `validDays` fora de 1–365 ou fracionado, `paymentTerms` vazio, `maxDiscountPercent` fora de 0–100, `expiryAlertDays` fora de 0–60.
- O front também confere CNPJ (14 dígitos, quando preenchido), e-mail e condições repetidas ou em branco antes de enviar.
- Um orçamento novo começa com `validUntil` = hoje + `validDays`, a primeira condição e as observações daqui. Orçamentos já criados guardam os próprios textos e não mudam quando as configurações mudam.
- O desconto sugerido vem do texto da condição ("… 5% de desconto"); a API não precisa interpretar.
- `company` aparece no cabeçalho do PDF (campos vazios são omitidos) e `footer` no fim da folha.
- `maxDiscountPercent`: o desconto do orçamento é comparado em % do subtotal (mesmo quando digitado em R$). Acima do limite, administrador e gerente confirmam e salvam; o vendedor só salva com a permissão `exceedDiscount`, senão a API recusa com 403 `discount_over_limit`.
- `expiryAlertDays`: veja "Validade e vencimento" em Orçamentos.
- `logo`: assim como as fotos de produto, o ideal é um upload (`POST /settings/logo`) que devolve a URL, guardada em `logo`.
- Só administrador faz o `PUT` (403 `forbidden` para os outros perfis).

---

## Pontos para decidir

Coisas que o front faz hoje porque não há backend, e que devem mudar quando a API existir. A coluna da direita diz o que muda no front.

| Hoje no front | Proposta | Impacto no front |
|---|---|---|
| IDs gerados no navegador (`newId('c')`, `newId('p')`…) | A API gera o id no `POST` e devolve o registro | Pequeno: só em `src/services/` |
| Orçamento guarda cliente e vendedor **pelo nome** (`customer`, `seller`); ao editar, o front procura pelo nome | Guardar também `customerId` e `sellerId` no orçamento e no `QuoteDraft` | Médio: formulário passa a enviar os ids |
| Cliente guarda o vendedor responsável pelo nome (`seller`) | `sellerId` no cliente | Pequeno |
| `Kpi.value` vem como texto pronto (`"R$ 1.234"`), com `icon` e `delta` em texto | API devolve números (`total`, `previous`); front formata e escolhe o ícone | Médio: dashboard |
| Transições de status não são validadas no serviço (só a tela limita os botões) | API valida conforme a tabela acima | Nenhum |
| Total calculado no front e enviado pronto | API recalcula com a regra acima e ignora o valor enviado | Nenhum |
| PDF gerado pela impressão do navegador | Pode continuar assim; se o WhatsApp precisar anexar o PDF, gerar no servidor | Nenhum por enquanto |
| Excluir vendedor ou produto não confere se está em uso | Bloquear (409) ou sugerir inativar quando houver orçamentos ou clientes ligados | Pequeno: tratar a mensagem |
| ~~Login conferido no navegador contra uma conta fixa~~ | Feito: a API confere a senha (hash scrypt) e a sessão vai num cookie HttpOnly; todas as rotas exigem sessão | Feito, com perfis: veja [Perfis e permissões](#perfis-e-permissões) |
| Lista de orçamentos sem paginação na API | Ok para o volume atual; paginar no servidor se crescer | Médio, só se for paginar |

## Como o front vai trocar

1. Criar `VITE_API_URL` no `.env`.
2. Em cada arquivo de `src/services/`, trocar `fromMock(() => ...)` por `fetch` para o endpoint correspondente, mantendo a assinatura da função.
3. Converter as respostas de erro nas classes que as telas já tratam (`QuoteNotFoundError`, `DuplicateProductCodeError`, `InvalidPeriodError`).
4. Apagar `src/services/mocks/` e ajustar os testes de serviço para usar um servidor falso (por exemplo, MSW).

Os testes de tela (`npm test`) usam os dados dos mocks (por exemplo, o orçamento #1181 pendente e o cliente "Restaurante Brasa Viva"). Na troca, esses dados viram fixtures do servidor falso, e os testes continuam conferindo o mesmo comportamento.
