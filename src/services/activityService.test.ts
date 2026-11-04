import { describe, expect, it } from 'vitest';
import { deleteActivity, listActivity } from './activityService';
import { getQuote } from './quotesService';
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
    expect(all.some((a) => a.area === 'Orçamentos' && a.quoteId !== null)).toBe(true);
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
});
