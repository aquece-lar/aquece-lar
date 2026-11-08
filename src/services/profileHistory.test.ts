import { afterEach, describe, expect, it } from 'vitest';
import { login, logout } from './authService';
import { MANAGER_ACCOUNT, SELLER_ACCOUNT } from './mocks/authMock';
import { customerHistory, sellerHistory } from './peopleService';
import { quotesSnapshot } from './quotesService';

afterEach(async () => {
  await logout();
});

describe('ficha do cliente e do vendedor (dados fictícios)', () => {
  it('traz todos os orçamentos do cliente, do mais recente ao mais antigo, e o último contato', async () => {
    const history = await customerHistory('c1');
    const own = quotesSnapshot().filter((q) => q.customer === 'Restaurante Brasa Viva');
    expect(history.quotes).toHaveLength(own.length);
    expect(history.quotes.length).toBeGreaterThan(0);
    expect(history.quotes.every((q, i) => i === 0 || history.quotes[i - 1]!.createdAt >= q.createdAt)).toBe(true);
    // O último passo é no mínimo a criação do orçamento mais recente.
    expect(history.lastActivityAt! >= history.quotes[0]!.createdAt).toBe(true);
  });

  it('traz os orçamentos do vendedor', async () => {
    const history = await sellerHistory('v2');
    expect(history.quotes.length).toBeGreaterThan(0);
    expect(new Set(history.quotes.map((q) => q.seller))).toEqual(new Set(['Patrícia Lima']));
  });

  it('cadastro inexistente responde 404', async () => {
    await expect(customerHistory('nao-existe')).rejects.toMatchObject({ status: 404 });
    await expect(sellerHistory('nao-existe')).rejects.toMatchObject({ status: 404 });
  });

  it('o vendedor abre só os próprios clientes e não abre fichas de vendedor', async () => {
    await login(SELLER_ACCOUNT.email, SELLER_ACCOUNT.password, false);
    expect((await customerHistory('c1')).quotes.length).toBeGreaterThan(0);
    await expect(customerHistory('c2')).rejects.toMatchObject({ status: 404 });
    await expect(sellerHistory('v1')).rejects.toMatchObject({ status: 403 });
  });

  it('o gerente abre qualquer ficha', async () => {
    await login(MANAGER_ACCOUNT.email, MANAGER_ACCOUNT.password, false);
    expect((await customerHistory('c2')).quotes.length).toBeGreaterThan(0);
    expect((await sellerHistory('v1')).quotes.length).toBeGreaterThan(0);
  });
});
