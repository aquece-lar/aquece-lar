import { describe, expect, it } from 'vitest';
import { listActivity } from './activityService';
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
});
