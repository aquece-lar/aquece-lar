import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DailyPoint } from '@/types/dashboard';
import { DailyChart } from './DailyChart';

function days(count: number): DailyPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(2026, 9, 1 + i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { date: iso, quantity: i % 4, amount: (i % 4) * 1000, partial: false };
  });
}

/** Posições (índices) dos rótulos visíveis no eixo X. */
function labelIndexes(count: number): number[] {
  const { container, unmount } = render(<DailyChart points={days(count)} />);
  const axis = container.querySelector('[aria-hidden="true"]:last-child');
  const spans = Array.from(axis?.children ?? []);
  const shown = spans.flatMap((span, i) => (span.textContent ? [i] : []));
  unmount();
  return shown;
}

describe('DailyChart', () => {
  it('mostra o mês de 31 dias com rótulos espaçados por igual', () => {
    expect(labelIndexes(31)).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });

  it.each([7, 14, 28, 30, 31, 45, 60, 90, 120])('nunca põe dois rótulos colados (%i dias)', (count) => {
    const shown = labelIndexes(count);
    expect(shown.at(-1)).toBe(count - 1);
    const step = Math.max(1, Math.round(count / 6));
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i]! - shown[i - 1]!).toBeGreaterThanOrEqual(Math.ceil(step / 2));
    }
  });
});
