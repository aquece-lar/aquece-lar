import type { Settings } from '@/types/settings';
import { fromMock } from './mockLatency';
import { SETTINGS_MOCK } from './mocks/settingsMock';

export const MAX_VALID_DAYS = 365;

/** Cópia em memória: vale até a página ser recarregada, como os demais cadastros. */
let settings: Settings = structuredClone(SETTINGS_MOCK);

export class InvalidSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSettingsError';
  }
}

/** Regras que a API também deve aplicar; o formulário avisa antes de chegar aqui. */
function check(next: Settings): void {
  if (!next.company.name.trim()) throw new InvalidSettingsError('Informe o nome da empresa.');
  const days = next.quotes.validDays;
  if (!Number.isInteger(days) || days < 1 || days > MAX_VALID_DAYS) {
    throw new InvalidSettingsError(`A validade deve ser de 1 a ${MAX_VALID_DAYS} dias.`);
  }
  if (next.quotes.paymentTerms.length === 0) throw new InvalidSettingsError('Informe ao menos uma condição de pagamento.');
  const limit = next.quotes.maxDiscountPercent;
  if (limit !== null && (!Number.isFinite(limit) || limit < 0 || limit > 100)) {
    throw new InvalidSettingsError('O desconto máximo deve ser de 0 a 100%.');
  }
}

export function getSettings(signal?: AbortSignal): Promise<Settings> {
  return fromMock(() => structuredClone(settings), signal);
}

export function saveSettings(next: Settings): Promise<Settings> {
  return fromMock(() => {
    check(next);
    settings = structuredClone(next);
    return structuredClone(settings);
  });
}
