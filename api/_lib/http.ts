/** Erro com status HTTP e corpo `{ error, message }`, como no contrato. */
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

export const notFound = (what: string) => new ApiError(404, 'not_found', `${what} não encontrado.`);
export const invalid = (message: string) => new ApiError(400, 'validation', message);

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function noContent(headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 204, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) return json({ error: error.code, message: error.message }, error.status);
  console.error('Erro não tratado na API', error);
  return json({ error: 'internal', message: 'Erro interno. Tente novamente em instantes.' }, 500);
}

/** Corpo JSON como objeto; qualquer outra coisa é 400. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('O corpo da requisição deve ser um objeto JSON.');
  }
  return body as Record<string, unknown>;
}

// Leitura dos campos do corpo, com a mensagem que vai para o usuário.

export function text(body: Record<string, unknown>, key: string, label: string, opts: { min?: number; max?: number } = {}): string {
  const raw = body[key] ?? '';
  if (typeof raw !== 'string') throw invalid(`${label} deve ser um texto.`);
  const value = raw.trim();
  if (opts.min && value.length < opts.min) {
    throw invalid(opts.min === 1 ? `Informe ${label.toLowerCase()}.` : `${label} deve ter ao menos ${opts.min} caracteres.`);
  }
  if (value.length > (opts.max ?? 200)) throw invalid(`${label} pode ter no máximo ${opts.max ?? 200} caracteres.`);
  return value;
}

export function oneOf<T extends string>(body: Record<string, unknown>, key: string, message: string, options: readonly T[]): T {
  const value = body[key];
  if (typeof value !== 'string' || !options.includes(value as T)) throw invalid(message);
  return value as T;
}

export function money(value: unknown, label: string, opts: { nullable?: boolean } = {}): number | null {
  if (value === null && opts.nullable) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw invalid(`${label} deve ser maior que zero.`);
  return Math.round(value * 100) / 100;
}
