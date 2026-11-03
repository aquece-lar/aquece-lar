import { describe, expect, it } from 'vitest';
import type { QuoteStatus } from '@/types/dashboard';
import { expiryLabel, expiryShortLabel, quoteExpiry } from './quoteExpiry';

const TODAY = '2026-10-31';

function quote(validUntil: string, status: QuoteStatus = 'Pendente') {
  return { status, validUntil };
}

describe('quoteExpiry', () => {
  it('só pendentes e enviados vencem', () => {
    expect(quoteExpiry(quote('2026-10-01', 'Aprovado'), 3, TODAY)).toBeNull();
    expect(quoteExpiry(quote('2026-10-01', 'Cancelado'), 3, TODAY)).toBeNull();
    expect(quoteExpiry(quote('2026-10-01', 'Enviado'), 3, TODAY)).toEqual({ kind: 'expired', days: 30 });
  });

  it('vale até o fim do último dia e avisa com a antecedência configurada', () => {
    expect(quoteExpiry(quote('2026-10-30'), 3, TODAY)).toEqual({ kind: 'expired', days: 1 });
    expect(quoteExpiry(quote('2026-10-31'), 3, TODAY)).toEqual({ kind: 'expiring', days: 0 });
    expect(quoteExpiry(quote('2026-11-03'), 3, TODAY)).toEqual({ kind: 'expiring', days: 3 });
    expect(quoteExpiry(quote('2026-11-04'), 3, TODAY)).toBeNull();
    expect(quoteExpiry(quote('2026-11-01'), 0, TODAY)).toBeNull();
  });

  it('atravessa a troca de mês e de horário de verão sem errar o dia', () => {
    expect(quoteExpiry(quote('2026-11-02'), 5, '2026-10-30')).toEqual({ kind: 'expiring', days: 3 });
    expect(quoteExpiry(quote('2027-02-20'), 30, '2027-02-14')).toEqual({ kind: 'expiring', days: 6 });
  });

  it('escreve o selo', () => {
    expect(expiryLabel({ kind: 'expiring', days: 0 })).toBe('Vence hoje');
    expect(expiryLabel({ kind: 'expiring', days: 1 })).toBe('Vence amanhã');
    expect(expiryLabel({ kind: 'expiring', days: 3 })).toBe('Vence em 3 dias');
    expect(expiryLabel({ kind: 'expired', days: 1 })).toBe('Venceu ontem');
    expect(expiryLabel({ kind: 'expired', days: 12 })).toBe('Vencido há 12 dias');
  });
});

describe('expiryShortLabel', () => {
  it('resume para as listas', () => {
    expect(expiryShortLabel({ kind: 'expiring', days: 0 })).toBe('Venc. hoje');
    expect(expiryShortLabel({ kind: 'expiring', days: 1 })).toBe('1 dia');
    expect(expiryShortLabel({ kind: 'expiring', days: 2 })).toBe('2 dias');
    expect(expiryShortLabel({ kind: 'expired', days: 9 })).toBe('Vencido');
  });
});
