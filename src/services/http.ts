/**
 * Dados fictícios em memória só nos testes (Vitest) ou com VITE_USE_MOCKS=true;
 * no resto, os serviços chamam a API em /api (funções da Vercel em api/).
 */
export const USE_MOCKS = import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_MOCKS === 'true';

/** Erro devolvido pela API: `{ error, message }` com o status HTTP. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Ids criados no navegador (`newId`) ainda não existem na API; os da API são numéricos. */
export function isSavedId(id: string): boolean {
  return /^\d+$/.test(id);
}

export async function api<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(
      response.status,
      error.error ?? 'http_error',
      error.message ?? 'Não foi possível falar com o servidor. Tente novamente.',
    );
  }
  return data as T;
}
