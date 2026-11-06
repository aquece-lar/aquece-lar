import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@/types/notifications';
import { NotificationsMenu } from './NotificationsMenu';

const listNotifications = vi.hoisted(() => vi.fn<() => Promise<Notification[]>>());

vi.mock('@/services/notificationsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/notificationsService')>()),
  listNotifications,
}));

function notification(id: string, days: number): Notification {
  return {
    id: `quote-expiring-${id}-2026-11-0${6 + days}`,
    kind: 'quote_expiring',
    title: `#${id} ${days === 0 ? 'vence hoje' : `vence em ${days} dias`}`,
    message: `Cliente ${id} · Aline Costa · R$ 1.000,00`,
    link: `/orcamentos/${id}`,
    quote: { id, number: `#${id}`, customer: `Cliente ${id}`, seller: 'Aline Costa', amount: 1000, validUntil: '2026-11-06', days },
  };
}

beforeEach(() => listNotifications.mockReset());
afterEach(() => window.localStorage.clear());

function renderMenu() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <NotificationsMenu />
    </MemoryRouter>,
  );
  return user;
}

describe('NotificationsMenu', () => {
  it('conta os novos, lista ao abrir e zera o contador depois de visto', async () => {
    listNotifications.mockResolvedValue([notification('1142', 0), notification('1147', 2)]);
    const user = renderMenu();

    const bell = await screen.findByRole('button', { name: 'Notificações, 2 novas' });
    expect(within(bell).getByText('2')).toBeInTheDocument();

    await user.click(bell);
    const panel = screen.getByRole('dialog', { name: 'Avisos' });
    expect(within(panel).getByRole('link', { name: /#1142 vence hoje/ })).toHaveAttribute('href', '/orcamentos/1142');
    expect(within(panel).getByText('Venc. hoje')).toBeInTheDocument();
    expect(within(panel).getByText('2 dias')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument();
  });

  it('volta a contar só o aviso novo que aparecer depois', async () => {
    listNotifications.mockResolvedValue([notification('1142', 0)]);
    const user = renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Notificações, 1 nova' }));
    await user.keyboard('{Escape}');

    listNotifications.mockResolvedValue([notification('1142', 0), notification('1150', 1)]);
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notificações, 1 nova' })).toBeInTheDocument());
  });

  it('mostra quando não há nada vencendo', async () => {
    listNotifications.mockResolvedValue([]);
    const user = renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Nenhum orçamento vencendo por agora.')).toBeInTheDocument();
  });
});
