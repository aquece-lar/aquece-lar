// O "dia" de um orçamento e o mês corrente são os de São Paulo, também nas regras
// compartilhadas com o front (que usam datas locais).
process.env.TZ = 'America/Sao_Paulo';

import { handle } from './_lib/router.js';

/**
 * Única função da API: o vercel.json reescreve /api/<caminho> para cá com
 * ?path=<caminho>, e o roteador em _lib/router.ts decide o que fazer.
 */
function entry(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? '';
  url.searchParams.delete('path');
  return handle(new Request(url, request), path);
}

export { entry as GET, entry as POST, entry as PUT, entry as DELETE };
