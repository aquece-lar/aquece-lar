/**
 * Outro jeito de chamar um produto do catálogo: como o cliente fala
 * ("aquecedor 20 litros") ou o código de outra marca ("Rinnai REU-1002").
 * O bot usa para entender o pedido, e a busca do orçamento também.
 */
export interface Equivalence {
  id: string;
  /** O que o cliente escreve. */
  term: string;
  productId: string;
  /** Do cadastro do produto, para a lista. */
  productCode: string;
  productDescription: string;
  productActive: boolean;
  /** Marca, quando o termo é o código de outro fabricante; vazio = apelido. */
  brand: string;
}

export type EquivalenceDraft = Pick<Equivalence, 'term' | 'productId' | 'brand'>;

export const MAX_TERM = 120;
