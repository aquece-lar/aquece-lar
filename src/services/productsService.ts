import type { Product } from '@/types/products';
import { describeProductChanges } from '@/lib/changes';
import { api, ApiError, isSavedId, USE_MOCKS } from './http';
import { recordMockActivity, recordMockSave } from './mockActivity';
import { fromMock } from './mockLatency';
import { mockEnsure } from './mockSession';
import { PRODUCTS_MOCK } from './mocks/productsMock';

/** Modo fictício (testes): cópia em memória do cadastro, até recarregar a página. */
let products = [...PRODUCTS_MOCK];

export class DuplicateProductCodeError extends Error {
  constructor(code: string) {
    super(`Já existe um produto com o código ${code}.`);
    this.name = 'DuplicateProductCodeError';
  }
}

/** Códigos comparados sem diferenciar maiúsculas e espaços nas pontas. */
export function sameCode(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

/** Ativos primeiro, depois os inativos; dentro de cada grupo, a ordem do cadastro. */
export function listProducts(signal?: AbortSignal): Promise<Product[]> {
  if (!USE_MOCKS) return api<Product[]>('GET', '/products', undefined, signal);
  return fromMock(
    () => [...products.filter((p) => p.status === 'Ativo'), ...products.filter((p) => p.status !== 'Ativo')],
    signal,
  );
}

/**
 * Cria ou atualiza; o código precisa ser único no cadastro. Produto novo entra
 * no topo; o que acaba de ficar inativo (ou já nasce inativo) vai para o fim.
 */
export async function saveProduct(product: Product): Promise<Product> {
  if (!USE_MOCKS) {
    const { id, code, description, category, unitPrice, status, photos = [] } = product;
    const body = { code, description, category, unitPrice, status, photos };
    try {
      return isSavedId(id) ? await api<Product>('PUT', `/products/${id}`, body) : await api<Product>('POST', '/products', body);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'duplicate_product_code') throw new DuplicateProductCodeError(code);
      throw error;
    }
  }
  return fromMock(() => {
    mockEnsure('manageCatalog');
    if (products.some((p) => p.id !== product.id && sameCode(p.code, product.code))) {
      throw new DuplicateProductCodeError(product.code);
    }
    const current = products.find((p) => p.id === product.id);
    const others = products.filter((p) => p.id !== product.id);
    if (product.status === 'Inativo' && current?.status !== 'Inativo') products = [...others, product];
    else if (current) products = products.map((p) => (p.id === product.id ? product : p));
    else products = [product, ...products];
    recordMockSave('Produtos', `Produto ${product.code}`, current, product, describeProductChanges);
    return product;
  });
}

export function deleteProduct(id: string): Promise<void> {
  if (!USE_MOCKS) return api<void>('DELETE', `/products/${id}`);
  return fromMock(() => {
    mockEnsure('manageCatalog');
    const current = products.find((p) => p.id === id);
    products = products.filter((p) => p.id !== id);
    if (current) recordMockActivity('Produtos', `Produto ${current.code} excluído`);
  });
}
