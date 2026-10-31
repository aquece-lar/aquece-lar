import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '@/lib/format';
import { ExpiryBadge } from './ExpiryBadge';

function inDays(days: number): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

describe('ExpiryBadge', () => {
  it('compacto mostra só o prazo curto; o texto inteiro fica no título e no leitor de tela', () => {
    const { container } = render(
      <ExpiryBadge quote={{ status: 'Enviado', validUntil: inDays(2) }} alertDays={3} compact />,
    );
    const badge = container.firstElementChild as HTMLElement;
    expect(badge).toHaveAttribute('title', 'Vence em 2 dias');
    expect(screen.getByText('2 dias')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Vence em 2 dias')).toHaveClass('sr-only');
  });

  it('compacto de vencido diz só "vencido"', () => {
    render(<ExpiryBadge quote={{ status: 'Pendente', validUntil: inDays(-5) }} alertDays={3} compact />);
    expect(screen.getByText('vencido')).toBeInTheDocument();
    expect(screen.getByText('Vencido há 5 dias')).toHaveClass('sr-only');
  });

  it('completo (detalhe) mostra o texto inteiro', () => {
    render(<ExpiryBadge quote={{ status: 'Pendente', validUntil: inDays(0) }} alertDays={3} />);
    expect(screen.getByText('Vence hoje')).not.toHaveClass('sr-only');
    expect(screen.queryByText('hoje')).not.toBeInTheDocument();
  });

  it('não aparece em aprovado nem fora do prazo de aviso', () => {
    const { container } = render(
      <>
        <ExpiryBadge quote={{ status: 'Aprovado', validUntil: inDays(-5) }} alertDays={3} compact />
        <ExpiryBadge quote={{ status: 'Enviado', validUntil: inDays(10) }} alertDays={3} compact />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
