import type { Equivalence, EquivalenceDraft } from '@/types/equivalences';
import { MAX_TERM } from '@/types/equivalences';
import { describeEquivalenceChanges } from '@/lib/changes';
import { equivalenceTitle, normalizeTerm } from '@/lib/equivalence';
import { api, ApiError, isSavedId, USE_MOCKS } from './http';
import { recordMockActivity, recordMockSave } from './mockActivity';
import { fromMock } from './mockLatency';
import { mockEnsure } from './mockSession';
import { EQUIVALENCES_MOCK } from './mocks/equivalencesMock';
import { productsSnapshot } from './productsService';

/** Modo fictício (testes): cópia em memória, até recarregar a página. Guarda só o id do produto. */
let equivalences: { id: string; term: string; productId: string; brand: string }[] = EQUIVALENCES_MOCK.map(
  ({ id, term, productId, brand }) => ({ id, term, productId, brand }),
);
let nextId = equivalences.length + 1;

/** Com o produto como está agora no cadastro; se o produto sumiu, a equivalência some junto (como no banco). */
function withProduct(e: (typeof equivalences)[number]): Equivalence | null {
  const product = productsSnapshot().find((p) => p.id === e.productId);
  if (!product) return null;
  return {
    ...e,
    productCode: product.code,
    productDescription: product.description,
    productActive: product.status === 'Ativo',
  };
}

/** Mesmas regras da API (api/_lib/equivalences.ts). */
function checkDraft(draft: EquivalenceDraft, exceptId?: string): EquivalenceDraft {
  const term = draft.term.trim();
  if (!term) throw new ApiError(400, 'validation', 'Informe o termo.');
  if (term.length > MAX_TERM) throw new ApiError(400, 'validation', `O termo pode ter no máximo ${MAX_TERM} caracteres.`);
  if (!productsSnapshot().some((p) => p.id === draft.productId)) throw new ApiError(400, 'validation', 'Escolha o produto.');
  const repeated = equivalences.some(
    (e) => e.id !== exceptId && e.productId === draft.productId && normalizeTerm(e.term) === normalizeTerm(term),
  );
  if (repeated) throw new ApiError(409, 'duplicate_equivalence', `"${term}" já aponta para este produto.`);
  return { term, productId: draft.productId, brand: draft.brand.trim() };
}

/** Em ordem alfabética do termo. */
export function listEquivalences(signal?: AbortSignal): Promise<Equivalence[]> {
  if (!USE_MOCKS) return api<Equivalence[]>('GET', '/equivalences', undefined, signal);
  return fromMock(
    () =>
      equivalences
        .map(withProduct)
        .filter((e): e is Equivalence => e !== null)
        .sort((a, b) => a.term.localeCompare(b.term, 'pt-BR')),
    signal,
  );
}

/** Cria (`id` vazio ou ainda não salvo) ou atualiza. Gerente e administrador. */
export function saveEquivalence(id: string | null, draft: EquivalenceDraft): Promise<Equivalence> {
  if (!USE_MOCKS) {
    return id && isSavedId(id)
      ? api<Equivalence>('PUT', `/equivalences/${id}`, draft)
      : api<Equivalence>('POST', '/equivalences', draft);
  }
  return fromMock(() => {
    mockEnsure('manageCatalog');
    const current = id ? equivalences.find((e) => e.id === id) : undefined;
    const clean = checkDraft(draft, current?.id);
    const saved = { id: current?.id ?? `e${nextId++}`, ...clean };
    equivalences = current ? equivalences.map((e) => (e.id === saved.id ? saved : e)) : [...equivalences, saved];
    const before = current ? (withProduct(current) ?? undefined) : undefined;
    const result = withProduct(saved)!;
    recordMockSave('Produtos', equivalenceTitle(result), before, result, describeEquivalenceChanges);
    return result;
  });
}

export function deleteEquivalence(id: string): Promise<void> {
  if (!USE_MOCKS) return api<void>('DELETE', `/equivalences/${id}`);
  return fromMock(() => {
    mockEnsure('manageCatalog');
    const current = equivalences.find((e) => e.id === id);
    if (!current) throw new ApiError(404, 'not_found', 'Equivalência não encontrada.');
    equivalences = equivalences.filter((e) => e.id !== id);
    const before = withProduct(current);
    if (before) recordMockActivity('Produtos', `${equivalenceTitle(before)} excluído`);
  });
}
