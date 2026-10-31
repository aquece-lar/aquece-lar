import type { CatalogProduct } from './quotes';

export type ProductStatus = 'Ativo' | 'Inativo';

export const PRODUCT_CATEGORIES = [
  'Aquecedores a gás',
  'Boilers',
  'Lareiras',
  'Piscina',
  'Acessórios',
  'Serviços',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Produto do cadastro; os ativos formam o catálogo do orçamento. */
export interface Product extends CatalogProduct {
  id: string;
  category: ProductCategory;
  status: ProductStatus;
  /** Fotos como data URL (JPEG reduzido); a primeira é a capa. */
  photos?: string[];
}
