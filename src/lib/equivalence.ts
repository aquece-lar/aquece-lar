import type { Equivalence } from '@/types/equivalences';

/** Sem acento, minúsculo, só letras e números separados por um espaço: "Aquecedor 20L!" → "aquecedor 20l". */
export function normalizeTerm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface EquivalenceMatch {
  productId: string;
  productCode: string;
  productDescription: string;
  /** O termo que bateu (o mais longo, se mais de um). */
  term: string;
}

/**
 * Produtos que uma frase do cliente cita: cada termo que aparece inteiro na
 * frase (palavra por palavra) aponta para o seu produto. Termos mais longos
 * são mais específicos e vêm primeiro; cada produto aparece uma vez.
 * Mesma regra na tela de teste e, depois, no bot.
 */
export function findProducts(text: string, equivalences: readonly Equivalence[]): EquivalenceMatch[] {
  const phrase = ` ${normalizeTerm(text)} `;
  if (phrase.trim() === '') return [];
  const hits = equivalences
    .map((e) => ({ e, term: normalizeTerm(e.term) }))
    .filter(({ term }) => term !== '' && phrase.includes(` ${term} `))
    .sort((a, b) => b.term.length - a.term.length);
  const seen = new Set<string>();
  const found: EquivalenceMatch[] = [];
  for (const { e } of hits) {
    if (seen.has(e.productId)) continue;
    seen.add(e.productId);
    found.push({ productId: e.productId, productCode: e.productCode, productDescription: e.productDescription, term: e.term });
  }
  return found;
}

/** Como aparece no histórico, igual na API: "Termo “aquecedor 20 litros” (AQG-20D)". */
export function equivalenceTitle(e: Pick<Equivalence, 'term' | 'productCode'>): string {
  return `Termo “${e.term}” (${e.productCode})`;
}
