import { useEffect, useState } from 'react';
import { getSettings } from '@/services/settingsService';
import type { Settings } from '@/types/settings';

type SettingsState =
  | { status: 'loading'; data: Settings | null }
  | { status: 'success'; data: Settings }
  | { status: 'error'; data: Settings | null; message: string };

const ERROR_MESSAGE = 'Não foi possível carregar as configurações.';

/** Carrega as configurações de forma cancelável; `reloadKey` força nova busca. */
export function useSettings(reloadKey = 0): SettingsState {
  const [state, setState] = useState<SettingsState>({ status: 'loading', data: null });

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ status: 'loading', data: prev.data }));

    getSettings(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(ERROR_MESSAGE, error);
        setState((prev) => ({ status: 'error', data: prev.data, message: ERROR_MESSAGE }));
      });

    return () => controller.abort();
  }, [reloadKey]);

  return state;
}
