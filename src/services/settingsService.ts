import type { Settings } from '@/types/settings';
import { settingsProblem } from '@/lib/settingsRules';
import { api, ApiError, USE_MOCKS } from './http';
import { fromMock } from './mockLatency';
import { SETTINGS_MOCK } from './mocks/settingsMock';

export { MAX_ALERT_DAYS, MAX_VALID_DAYS } from '@/lib/settingsRules';

/** Cópia em memória do modo fictício: vale até a página ser recarregada. */
let settings: Settings = structuredClone(SETTINGS_MOCK);

export class InvalidSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSettingsError';
  }
}

export function getSettings(signal?: AbortSignal): Promise<Settings> {
  if (!USE_MOCKS) return api<Settings>('GET', '/settings', undefined, signal);
  return fromMock(() => structuredClone(settings), signal);
}

export async function saveSettings(next: Settings): Promise<Settings> {
  if (!USE_MOCKS) {
    try {
      return await api<Settings>('PUT', '/settings', next);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'validation') throw new InvalidSettingsError(error.message);
      throw error;
    }
  }
  return fromMock(() => {
    const problem = settingsProblem(next);
    if (problem) throw new InvalidSettingsError(problem);
    settings = structuredClone(next);
    return structuredClone(settings);
  });
}
