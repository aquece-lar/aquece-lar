# Aquece Lar — Orçamentos (frontend)

Aplicação React do dashboard Aquece Lar, convertida a partir do mockup HTML em `prototipo/`. Apenas o frontend: os dados vêm de mocks locais, com a mesma assinatura que um serviço HTTP futuro usaria.

## Stack

- React 19 + TypeScript
- Vite
- React Router
- CSS Modules + variáveis CSS do design original (tema claro/escuro)

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

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

- Dashboard com período filtrável, KPIs, gráfico diário (quantidade/valor), ranking com a meta de cada vendedor (proporcional ao período), orçamentos vencendo e últimos orçamentos, tudo calculado a partir dos orçamentos (um orçamento novo aparece na hora)
- Sidebar recolhível no desktop e gaveta no mobile
- Tema claro/escuro persistido em `localStorage`
- Orçamentos: lista com período, busca, filtro de status e paginação; detalhe com troca de status e PDF pela impressão do navegador; criação de orçamento com cliente, vendedor e produto buscáveis pelo nome (com cadastro de cliente ali mesmo), desconto (% ou R$, sugerido pela condição de pagamento) e condições, avisando antes de sair com alterações não salvas; edição de pendentes e cópia de qualquer orçamento
- Vendedores e clientes: listagem com busca e filtros, cadastro, edição e exclusão; vendedor com meta mensal opcional
- Vencimento: pendentes e enviados ganham selo "Vence em N dias" (antecedência nas configurações) ou "Vencido" na lista e no detalhe
- Produtos: listagem com busca e filtro de status, cadastro com código único, categoria e preço de tabela; os ativos formam o catálogo do orçamento
- Configurações: dados da empresa (nome, CNPJ, contato, endereço e logo) no cabeçalho do PDF e um rodapé livre (PIX, banco, garantia); validade, condições de pagamento e observações com que um orçamento novo começa; desconto máximo, acima do qual o orçamento pede confirmação; dias de aviso de vencimento
- Linhas, fluxogramas, conversas e equivalências ainda são placeholders

Cadastros, configurações, edições, mudanças de status e orçamentos novos ficam em memória e se perdem ao recarregar a página. As datas dos orçamentos de exemplo acompanham o relógio (o mais recente é de ontem), e as contagens de orçamentos de clientes e vendedores são calculadas sobre eles.

O backend ainda não faz parte deste projeto. Para ligar uma API, substitua as funções em `src/services/` (mantendo as assinaturas) e remova os mocks em `src/services/mocks/`. O que o front espera de cada endpoint (formatos, regras e erros) está em [docs/api-contrato.md](docs/api-contrato.md).
