import { describe, expect, it } from 'vitest';
import { deleteActivity, listActivity } from './activityService';
import { getQuote } from './quotesService';
import { deleteCustomer, listSellers, saveCustomer, saveSeller } from './peopleService';
import { listProducts, saveProduct } from './productsService';
import { getSettings, saveSettings } from './settingsService';
import { createUser, deleteUser } from './usersService';

describe('listActivity (dados fictícios)', () => {
  it('junta orçamentos, configurações e usuários, do mais recente para o mais antigo', async () => {
    const settings = await getSettings();
    await saveSettings({ ...settings, quotes: { ...settings.quotes, maxDiscountPercent: 15 } });
    const user = await createUser({
      name: 'Pessoa Nova',
      email: 'pessoa.nova@aquecelar.com.br',
      password: 'senha-forte',
      role: 'Gerente',
      sellerId: null,
      seeAll: false,
      exceedDiscount: false,
    });
    await deleteUser(user.id);

    const all = await listActivity(null);
    expect(all.slice(0, 3).map((a) => a.summary)).toEqual([
      'Usuário Pessoa Nova excluído',
      'Usuário Pessoa Nova criado',
      'Configurações alteradas',
    ]);
    expect(all[2]!.detail).toBe('desconto máximo: 10% → 15%');
    expect(all[2]!.by).toBe('Administrador');
    const quote = all.find((a) => a.area === 'Orçamentos');
    expect(quote?.quoteId).not.toBeNull();
    expect(quote?.quote).toMatchObject({ seller: expect.any(String), customer: expect.any(String), amount: expect.any(Number) });
    expect(all.find((a) => a.area === 'Usuários')?.quote).toBeNull();
    expect(all.every((a, i) => i === 0 || Date.parse(all[i - 1]!.at) >= Date.parse(a.at))).toBe(true);

    const onlyUsers = await listActivity('Usuários');
    expect(onlyUsers.map((a) => a.area)).toEqual(['Usuários', 'Usuários']);
  });

  it('apaga os escolhidos e tudo, sem mexer na linha do tempo do orçamento, e registra a limpeza', async () => {
    const before = await listActivity('Orçamentos');
    const target = before[0]!;
    expect(await deleteActivity([target.id])).toBe(1);

    const after = await listActivity(null);
    expect(after.some((a) => a.id === target.id)).toBe(false);
    expect(after[0]).toMatchObject({ summary: 'Histórico apagado', detail: '1 item', area: 'Configurações' });
    const quote = await getQuote(target.quoteId!);
    expect(quote.history.length).toBeGreaterThan(0);

    const total = after.length;
    // A lista mostra no máximo 300; "tudo" apaga também o que não aparece.
    const deleted = await deleteActivity('all');
    expect(deleted).toBeGreaterThanOrEqual(total);
    const cleared = await listActivity(null);
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatchObject({ summary: 'Histórico apagado', detail: `tudo (${deleted} itens)` });
  });

  it('registra cadastrar, editar (com o que mudou) e excluir em clientes, vendedores e produtos', async () => {
    const [product] = await listProducts();
    await saveProduct({ ...product!, unitPrice: product!.unitPrice + 100 });
    const [seller] = await listSellers();
    await saveSeller({ ...seller!, region: 'Litoral' });
    await saveSeller({ ...seller!, region: 'Litoral' }); // sem mudança: nada novo
    await saveCustomer({
      id: 'c-teste',
      name: 'Cliente do Teste',
      kind: 'PF',
      document: '',
      phone: '',
      city: '',
      seller: 'Carlos Menezes',
      quotes: 0,
      lastQuoteAt: null,
    });
    await deleteCustomer('c-teste');

    const [deleted, created, sellerEdit, productEdit] = await listActivity(null);
    expect(deleted).toMatchObject({ area: 'Clientes', summary: 'Cliente Cliente do Teste excluído' });
    expect(created).toMatchObject({ area: 'Clientes', summary: 'Cliente Cliente do Teste cadastrado' });
    expect(sellerEdit).toMatchObject({ area: 'Vendedores', summary: `Vendedor ${seller!.name} editado` });
    expect(sellerEdit!.detail).toContain('região:');
    expect(productEdit).toMatchObject({ area: 'Produtos', summary: `Produto ${product!.code} editado` });
    expect(productEdit!.detail).toMatch(/^preço: R\$/);
    expect((await listActivity('Produtos')).every((a) => a.area === 'Produtos')).toBe(true);
  });
});
