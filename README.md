# Aquece Lar — Orçamentos

Aplicação React do dashboard Aquece Lar, convertida a partir do mockup HTML em `prototipo/`. Apenas o frontend: os dados vêm de mocks locais, com a mesma assinatura que um serviço HTTP futuro usaria.

## Stack

- React 19 + TypeScript
- Vite
- React Router
- CSS Modules + variáveis CSS do design original (tema claro/escuro)

## Como rodar

O app fala com a API em `/api` (funções da Vercel em `api/`), que usa o Postgres do Neon ligado ao projeto na Vercel. Para rodar localmente:

```bash
npm install
npx vercel env pull .env.development.local   # credenciais do banco (fica fora do git)
npm run dev:api                              # API em http://localhost:3001
npm run dev                                  # app em http://localhost:5173 (repassa /api para a API)
```

Sem banco, dá para usar os dados fictícios: `VITE_USE_MOCKS=true npm run dev` (os testes sempre usam).

Banco:

```bash
npm run db:migrate          # cria as tabelas (pode rodar de novo)
npm run db:seed             # dados de exemplo, num banco vazio
npm run db:seed -- --reset  # apaga tudo e coloca os dados de exemplo de novo (não mexe nos usuários)
```

Usuários (quem pode entrar no sistema) se cadastram em Configurações → Usuários. Pelo terminal também dá, por exemplo para criar o primeiro; o script pede a senha sem mostrar:

```bash
npm run user:save -- email@exemplo.com "Nome da Pessoa"   # cria, ou troca a senha se já existir
npm run user:save -- email@exemplo.com --remove           # remove
```

Quem é criado pelo terminal entra como administrador; o perfil se troca em Configurações → Usuários.

Outros scripts:

```bash
npm test             # Vitest + Testing Library (jsdom), uma rodada
npm run test:watch   # testes em modo observação
npm run typecheck
npm run build
npm run preview
```

Os testes ficam ao lado do código (`*.test.ts(x)`) e cobrem o cálculo de totais e desconto, o serviço de orçamentos (incluindo a coerência dos mocks), o campo de busca e os fluxos do formulário de orçamento.

## Estrutura

```
src/
  components/     UI compartilhada (ícones, layout)
  config/         navegação
  contexts/       tema claro/escuro
  features/       dashboard (KPIs, gráfico, ranking, tabela)
  lib/            formatação pt-BR
  pages/          rotas
  services/       acesso a dados (hoje: mocks)
  styles/         tokens globais
prototipo/        mockup HTML original (referência visual)
```

## Comportamento atual

- Login obrigatório para todas as telas, com e-mail e senha dos usuários do banco (`npm run user:save`). A sessão é um cookie HttpOnly: com "Manter conectado" dura 30 dias; sem ele, acaba ao fechar o navegador (e no máximo em 12 h). O botão Sair fica no rodapé do menu. Nos dados fictícios há uma conta por perfil: `admin@aquecelar.com.br` / `admin@adm`, `gerente@aquecelar.com.br` / `gerente@adm` e o vendedor `carlos.menezes@aquecelar.com.br` / `vendedor@1` (`src/services/mocks/authMock.ts`)
- Perfis: administrador (tudo), gerente (tudo menos usuários e configurações) e vendedor (os próprios orçamentos e clientes, sem passar do desconto máximo). Para cada vendedor dá para liberar "ver de todos" e "passar do desconto máximo" em Configurações → Usuários. As regras ficam em `src/lib/access.ts`, e a API confere em cada rota
- Dashboard com período filtrável, KPIs, gráfico diário (quantidade/valor), ranking com a meta de cada vendedor (proporcional ao período), orçamentos vencendo e últimos orçamentos, tudo calculado a partir dos orçamentos (um orçamento novo aparece na hora)
- Sidebar recolhível no desktop e gaveta no mobile
- Tema claro/escuro persistido em `localStorage`
- Orçamentos: lista com período, busca, filtro de status e paginação; detalhe com troca de status e PDF pela impressão do navegador; criação de orçamento com cliente, vendedor e produto buscáveis pelo nome (com cadastro de cliente ali mesmo), desconto (% ou R$, sugerido pela condição de pagamento) e condições, avisando antes de sair com alterações não salvas; edição de pendentes e cópia de qualquer orçamento
- Vendedores e clientes: listagem com busca e filtros, cadastro, edição e exclusão; vendedor com meta mensal opcional
- Vencimento: pendentes e enviados ganham selo "Vence em N dias" (antecedência nas configurações) ou "Vencido" na lista e no detalhe
- Produtos: listagem com busca e filtro de status, cadastro com código único, categoria e preço de tabela; os ativos formam o catálogo do orçamento
- Configurações: dados da empresa (nome, CNPJ, contato, endereço e logo) no cabeçalho do PDF e um rodapé livre (PIX, banco, garantia); validade, condições de pagamento e observações com que um orçamento novo começa; desconto máximo, acima do qual o orçamento pede confirmação; dias de aviso de vencimento
- Linhas, fluxogramas, conversas e equivalências ainda são placeholders

Cadastros, configurações, edições, mudanças de status e orçamentos novos ficam no banco. No modo fictício (testes), ficam em memória e se perdem ao recarregar a página; ali as datas dos orçamentos de exemplo acompanham o relógio (o mais recente é de ontem).

## API

`api/index.ts` é a única função da Vercel: o `vercel.json` manda `/api/<caminho>` para ela e `api/_lib/router.ts` atende as rotas de [docs/api-contrato.md](docs/api-contrato.md) (vendedores, clientes, produtos, orçamentos, status, configurações e dashboard). As regras de cálculo (total, períodos, vencimento, dashboard) são as mesmas do front, em `src/lib/`; por isso esses arquivos importam uns aos outros com caminho relativo e `.js`, que é o que a função da Vercel entende.

Login: `POST /api/auth/login` confere a senha (hash scrypt na tabela `users`) e devolve um cookie HttpOnly com a sessão (só o hash do token fica na tabela `sessions`); `GET /api/auth/me` diz quem está conectado e `POST /api/auth/logout` encerra. Fora `/api/health` e essas, toda rota responde 401 sem sessão válida, e o front volta para a tela de login. Cada usuário tem um perfil (colunas `role`, `seller_id`, `see_all` e `exceed_discount` na tabela `users`; quem já existia virou administrador). Sem permissão, a rota responde 403. Cada passo do orçamento guarda quem fez e, na edição, o que mudou (`quote_events.user_name` e `detail`); configurações e usuários vão para `activity_log`. O administrador vê tudo em Configurações → Histórico de alterações (`GET /api/activity`).

O backend em PHP (`backend/`) foi a primeira versão da API, para MySQL; a Vercel não roda PHP, então ele não é usado.
