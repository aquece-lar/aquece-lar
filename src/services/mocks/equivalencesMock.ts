import type { Equivalence } from '@/types/equivalences';
import { PRODUCTS_MOCK } from './productsMock';

/** Apelidos e códigos de outras marcas para os produtos fictícios. */
const SEED: [productId: string, term: string, brand: string][] = [
  ['p1', 'aquecedor 20 litros', ''],
  ['p1', 'aquecedor digital', ''],
  ['p1', 'REU-1002', 'Rinnai'],
  ['p2', 'aquecedor 33 litros', ''],
  ['p2', 'aquecedor de passagem', ''],
  ['p2', 'KO 33', 'Komeco'],
  ['p3', 'boiler 200', ''],
  ['p3', 'reservatório de água quente', ''],
  ['p4', 'lareira 90', ''],
  ['p5', 'aquecedor de piscina', ''],
  ['p5', 'trocador de calor piscina', ''],
  ['p6', 'chaminé', ''],
  ['p8', 'registro de gás', ''],
  ['p9', 'instalação', ''],
];

export const EQUIVALENCES_MOCK: Equivalence[] = SEED.map(([productId, term, brand], i) => {
  const product = PRODUCTS_MOCK.find((p) => p.id === productId)!;
  return {
    id: `e${i + 1}`,
    term,
    productId,
    productCode: product.code,
    productDescription: product.description,
    productActive: product.status === 'Ativo',
    brand,
  };
});
