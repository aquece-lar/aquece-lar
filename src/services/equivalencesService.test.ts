import { afterEach, describe, expect, it } from 'vitest';
import { listActivity } from './activityService';
import { login, logout } from './authService';
import { deleteEquivalence, listEquivalences, saveEquivalence } from './equivalencesService';
import { SELLER_ACCOUNT } from './mocks/authMock';

afterEach(async () => {
  await logout();
});

describe('equivalências (dados fictícios)', () => {
  it('lista em ordem alfabética, com o produto como está no cadastro', async () => {
    const list = await listEquivalences();
    expect(list.length).toBeGreaterThan(0);
    expect(list.map((e) => e.term)).toEqual([...list.map((e) => e.term)].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    expect(list.find((e) => e.term === 'REU-1002')).toMatchObject({ productCode: 'AQG-20D', brand: 'Rinnai', productActive: true });
  });

  it('cadastra, edita e exclui, e cada passo vai para o histórico', async () => {
    const created = await saveEquivalence(null, { term: '  boiler grande ', productId: 'p3', brand: '' });
    expect(created).toMatchObject({ term: 'boiler grande', productCode: 'BLR-200' });

    const edited = await saveEquivalence(created.id, { term: 'boiler grande', productId: 'p3', brand: 'Genérico' });
    expect(edited.brand).toBe('Genérico');
    await deleteEquivalence(created.id);
    expect((await listEquivalences()).some((e) => e.id === created.id)).toBe(false);

    const [removed, changed, added] = await listActivity('Produtos');
    expect(added).toMatchObject({ summary: 'Termo “boiler grande” (BLR-200) cadastrado' });
    expect(changed).toMatchObject({ summary: 'Termo “boiler grande” (BLR-200) editado', detail: 'marca: — → Genérico' });
    expect(removed).toMatchObject({ summary: 'Termo “boiler grande” (BLR-200) excluído' });
  });

  it('recusa termo vazio, produto inexistente e o mesmo termo (escrito de outro jeito) no mesmo produto', async () => {
    await expect(saveEquivalence(null, { term: ' ', productId: 'p1', brand: '' })).rejects.toThrow('Informe o termo.');
    await expect(saveEquivalence(null, { term: 'x', productId: 'nao-existe', brand: '' })).rejects.toThrow('Escolha o produto.');
    await expect(saveEquivalence(null, { term: 'Aquecedor 20 LITROS', productId: 'p1', brand: '' })).rejects.toMatchObject({
      status: 409,
    });
    // O mesmo termo em outro produto pode (o bot mostra os dois).
    const other = await saveEquivalence(null, { term: 'aquecedor 20 litros', productId: 'p2', brand: '' });
    await deleteEquivalence(other.id);
  });

  it('o vendedor só consulta', async () => {
    await login(SELLER_ACCOUNT.email, SELLER_ACCOUNT.password, false);
    expect((await listEquivalences()).length).toBeGreaterThan(0);
    await expect(saveEquivalence(null, { term: 'novo', productId: 'p1', brand: '' })).rejects.toMatchObject({ status: 403 });
    await expect(deleteEquivalence('e1')).rejects.toMatchObject({ status: 403 });
  });
});
