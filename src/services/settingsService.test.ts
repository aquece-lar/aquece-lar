import { describe, expect, it } from 'vitest';
import { getSettings, InvalidSettingsError, saveSettings } from './settingsService';

describe('settingsService', () => {
  it('começa com os padrões de orçamento e o nome da empresa', async () => {
    const settings = await getSettings();
    expect(settings.company.name).toBe('Aquece Lar');
    expect(settings.company.logo).toBeNull();
    expect(settings.quotes.validDays).toBe(15);
    expect(settings.quotes.paymentTerms[0]).toBe('À vista com 5% de desconto');
  });

  it('salva e devolve cópias, sem expor o estado interno', async () => {
    const settings = await getSettings();
    settings.quotes.validDays = 30;
    expect((await getSettings()).quotes.validDays).toBe(15);

    const saved = await saveSettings(settings);
    saved.quotes.paymentTerms.push('mexido fora');
    const again = await getSettings();
    expect(again.quotes.validDays).toBe(30);
    expect(again.quotes.paymentTerms).not.toContain('mexido fora');
  });

  it.each([
    ['nome vazio', { company: { name: '  ' } }, /nome da empresa/],
    ['validade zero', { quotes: { validDays: 0 } }, /validade/],
    ['validade fracionada', { quotes: { validDays: 1.5 } }, /validade/],
    ['sem condições', { quotes: { paymentTerms: [] } }, /condição de pagamento/],
    ['desconto máximo acima de 100%', { quotes: { maxDiscountPercent: 120 } }, /desconto máximo/],
    ['desconto máximo negativo', { quotes: { maxDiscountPercent: -1 } }, /desconto máximo/],
  ])('recusa %s', async (_, patch, message) => {
    const current = await getSettings();
    const next = {
      company: { ...current.company, ...('company' in patch ? patch.company : {}) },
      quotes: { ...current.quotes, ...('quotes' in patch ? patch.quotes : {}) },
    };
    const attempt = saveSettings(next);
    await expect(attempt).rejects.toBeInstanceOf(InvalidSettingsError);
    await expect(attempt).rejects.toThrow(message);
  });
});
