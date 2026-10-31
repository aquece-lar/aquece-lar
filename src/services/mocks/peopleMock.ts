import type { Customer, Seller } from '@/types/people';

// As contagens de orçamentos ficam zeradas aqui: o peopleService as calcula
// a partir dos orçamentos a cada listagem.
export const SELLERS_MOCK: Seller[] = [
  { id: 'v1', name: 'Carlos Menezes', email: 'carlos.menezes@aquecelar.com.br', phone: '(54) 99812-4410', region: 'Serra Gaúcha', status: 'Ativo', monthlyGoal: 250000, quotes: 0, amount: 0 },
  { id: 'v2', name: 'Patrícia Lima', email: 'patricia.lima@aquecelar.com.br', phone: '(54) 99637-2281', region: 'Caxias do Sul', status: 'Ativo', monthlyGoal: 250000, quotes: 0, amount: 0 },
  { id: 'v3', name: 'Rafael Bortolini', email: 'rafael.bortolini@aquecelar.com.br', phone: '(54) 99104-7752', region: 'Bento Gonçalves', status: 'Ativo', monthlyGoal: 380000, quotes: 0, amount: 0 },
  { id: 'v4', name: 'Aline Costa', email: 'aline.costa@aquecelar.com.br', phone: '(51) 99358-6604', region: 'Porto Alegre', status: 'Ativo', monthlyGoal: 300000, quotes: 0, amount: 0 },
  { id: 'v5', name: 'Diego Ferraz', email: 'diego.ferraz@aquecelar.com.br', phone: '(51) 99271-3390', region: 'Vale do Sinos', status: 'Ativo', monthlyGoal: null, quotes: 0, amount: 0 },
  { id: 'v6', name: 'Tatiane Rocha', email: 'tatiane.rocha@aquecelar.com.br', phone: '(54) 99725-1148', region: 'Campos de Cima da Serra', status: 'Ativo', monthlyGoal: 200000, quotes: 0, amount: 0 },
  { id: 'v7', name: 'Gustavo Pereira', email: 'gustavo.pereira@aquecelar.com.br', phone: '(54) 99480-9013', region: 'Serra Gaúcha', status: 'Inativo', monthlyGoal: null, quotes: 0, amount: 0 },
  { id: 'v8', name: 'Larissa Antunes', email: 'larissa.antunes@aquecelar.com.br', phone: '(51) 99196-5527', region: 'Litoral Norte', status: 'Inativo', monthlyGoal: null, quotes: 0, amount: 0 },
];

export const CUSTOMERS_MOCK: Customer[] = [
  { id: 'c1', name: 'Restaurante Brasa Viva', kind: 'PJ', document: '12.345.678/0001-90', phone: '(54) 3222-1840', city: 'Caxias do Sul', seller: 'Carlos Menezes', quotes: 0, lastQuoteAt: null },
  { id: 'c2', name: 'Marcos Andrade', kind: 'PF', document: '123.456.789-09', phone: '(54) 99913-2207', city: 'Gramado', seller: 'Patrícia Lima', quotes: 0, lastQuoteAt: null },
  { id: 'c3', name: 'Condomínio Vale Verde', kind: 'PJ', document: '23.456.789/0001-01', phone: '(54) 3451-7720', city: 'Bento Gonçalves', seller: 'Rafael Bortolini', quotes: 0, lastQuoteAt: null },
  { id: 'c4', name: 'Juliana Teixeira', kind: 'PF', document: '234.567.890-12', phone: '(51) 99822-6631', city: 'Porto Alegre', seller: 'Aline Costa', quotes: 0, lastQuoteAt: null },
  { id: 'c5', name: 'Pousada Recanto da Serra', kind: 'PJ', document: '34.567.890/0001-12', phone: '(54) 3286-4415', city: 'Canela', seller: 'Carlos Menezes', quotes: 0, lastQuoteAt: null },
  { id: 'c6', name: 'Ricardo Moretto', kind: 'PF', document: '345.678.901-23', phone: '(51) 99634-0908', city: 'Novo Hamburgo', seller: 'Diego Ferraz', quotes: 0, lastQuoteAt: null },
  { id: 'c7', name: 'Espaço Gourmet Bento', kind: 'PJ', document: '45.678.901/0001-23', phone: '(54) 3452-9036', city: 'Bento Gonçalves', seller: 'Patrícia Lima', quotes: 0, lastQuoteAt: null },
  { id: 'c8', name: 'Ana Paula Ribeiro', kind: 'PF', document: '456.789.012-34', phone: '(54) 99157-8842', city: 'São Francisco de Paula', seller: 'Tatiane Rocha', quotes: 0, lastQuoteAt: null },
  { id: 'c9', name: 'Clube Recreativo Serrano', kind: 'PJ', document: '56.789.012/0001-34', phone: '(54) 3215-6650', city: 'Caxias do Sul', seller: 'Rafael Bortolini', quotes: 0, lastQuoteAt: null },
  { id: 'c10', name: 'Felipe Zanella', kind: 'PF', document: '567.890.123-45', phone: '(54) 99208-3176', city: 'Farroupilha', seller: 'Aline Costa', quotes: 0, lastQuoteAt: null },
  { id: 'c11', name: 'Hotel Bella Vista', kind: 'PJ', document: '67.890.123/0001-45', phone: '(54) 3295-1122', city: 'Nova Petrópolis', seller: 'Carlos Menezes', quotes: 0, lastQuoteAt: null },
  { id: 'c12', name: 'Beatriz Lazzari', kind: 'PF', document: '678.901.234-56', phone: '(54) 99476-5530', city: 'Flores da Cunha', seller: 'Diego Ferraz', quotes: 0, lastQuoteAt: null },
];
