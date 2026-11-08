import { describe, expect, it } from 'vitest';
import { EQUIVALENCES_MOCK } from '@/services/mocks/equivalencesMock';
import { findProducts, normalizeTerm } from './equivalence';

describe('normalizeTerm', () => {
  it('tira acento, pontuação e maiúsculas', () => {
    expect(normalizeTerm('  Aquecedor  20 Litros!! ')).toBe('aquecedor 20 litros');
    expect(normalizeTerm('Reservatório de água-quente')).toBe('reservatorio de agua quente');
  });
});

describe('findProducts', () => {
  it('acha os produtos citados numa frase, cada um uma vez', () => {
    const found = findProducts('Quanto custa um AQUECEDOR 20 litros com instalação?', EQUIVALENCES_MOCK);
    expect(found.map((f) => [f.productCode, f.term])).toEqual([
      ['AQG-20D', 'aquecedor 20 litros'],
      ['SRV-INS', 'instalação'],
    ]);
  });

  it('código de outra marca, escrito de outro jeito', () => {
    expect(findProducts('vocês têm o reu 1002 da rinnai?', EQUIVALENCES_MOCK).map((f) => f.productCode)).toEqual(['AQG-20D']);
  });

  it('o termo precisa aparecer inteiro, palavra por palavra', () => {
    // "aquecedor 200" não é "aquecedor 20 litros" nem "boiler 200".
    expect(findProducts('aquecedor 200', EQUIVALENCES_MOCK)).toEqual([]);
    expect(findProducts('chaminés', EQUIVALENCES_MOCK)).toEqual([]);
    expect(findProducts('', EQUIVALENCES_MOCK)).toEqual([]);
  });

  it('o termo mais longo vence quando dois apontam para produtos diferentes', () => {
    // "aquecedor de piscina" (PIS-AQ3) é mais específico que qualquer termo mais curto na frase.
    expect(findProducts('preciso de um aquecedor de piscina', EQUIVALENCES_MOCK)[0]?.productCode).toBe('PIS-AQ3');
  });
});
