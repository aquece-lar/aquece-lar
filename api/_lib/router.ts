import { caller, currentUser, login, logout } from './auth.js';
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from './customers.js';
import { getDashboard } from './dashboard.js';
import { db } from './db.js';
import { ApiError, errorResponse, json, noContent, readBody } from './http.js';
import { createProduct, deleteProduct, listProducts, updateProduct } from './products.js';
import { changeStatus, createQuote, getQuote, listQuotes, updateQuote } from './quotes.js';
import { createSeller, deleteSeller, listSellers, updateSeller } from './sellers.js';
import { getSettings, saveSettings } from './settings.js';
import { createUser, deleteUser, listUsers, updateUser } from './users.js';

type Crud = {
  list: () => Promise<unknown>;
  create: (body: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  remove: (id: string) => Promise<void>;
};

const CRUD: Record<string, Crud> = {
  sellers: { list: listSellers, create: createSeller, update: updateSeller, remove: deleteSeller },
  customers: { list: listCustomers, create: createCustomer, update: updateCustomer, remove: deleteCustomer },
  products: { list: listProducts, create: createProduct, update: updateProduct, remove: deleteProduct },
};

const METHOD_NOT_ALLOWED = new ApiError(405, 'method_not_allowed', 'Método não permitido.');

function period(url: URL) {
  return { from: url.searchParams.get('from') ?? '', to: url.searchParams.get('to') ?? '' };
}

/**
 * Todas as rotas do contrato (docs/api-contrato.md) numa só função da Vercel.
 * `path` é o caminho depois de /api, sem barras nas pontas (ex.: "quotes/12/status").
 */
export async function handle(request: Request, path: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const method = request.method;
    const [resource = '', id, action, ...rest] = path.split('/').filter(Boolean);

    if (resource === 'health' && !id) {
      await db()`select 1`;
      return json({ ok: true });
    }

    // Únicas rotas abertas: entrar, sair e saber quem está conectado.
    if (resource === 'auth' && !action) {
      if (id === 'login' && method === 'POST') {
        const { session, setCookie } = await login(request, await readBody(request));
        return json(session, 200, { 'Set-Cookie': setCookie });
      }
      if (id === 'logout' && method === 'POST') return noContent({ 'Set-Cookie': await logout(request) });
      if (id === 'me' && method === 'GET') return json(await currentUser(request));
    }

    // Todo o resto exige sessão.
    const me = await caller(request);

    // Ids são numéricos; qualquer outra coisa não existe.
    if (rest.length > 0 || (id !== undefined && !/^\d+$/.test(id))) throw new ApiError(404, 'not_found', 'Rota não encontrada.');

    if (resource === 'dashboard' && !id) {
      if (method !== 'GET') throw METHOD_NOT_ALLOWED;
      return json(await getDashboard(period(url)));
    }

    if (resource === 'settings' && !id) {
      if (method === 'GET') return json(await getSettings());
      if (method === 'PUT') return json(await saveSettings(await readBody(request)));
      throw METHOD_NOT_ALLOWED;
    }

    if (resource === 'quotes') {
      if (!id) {
        if (method === 'GET') return json(await listQuotes(period(url)));
        if (method === 'POST') return json(await createQuote(await readBody(request)), 201);
        throw METHOD_NOT_ALLOWED;
      }
      if (action === 'status') {
        if (method !== 'POST') throw METHOD_NOT_ALLOWED;
        return json(await changeStatus(id, await readBody(request)));
      }
      if (action) throw new ApiError(404, 'not_found', 'Rota não encontrada.');
      if (method === 'GET') return json(await getQuote(id));
      if (method === 'PUT') return json(await updateQuote(id, await readBody(request)));
      throw METHOD_NOT_ALLOWED;
    }

    if (resource === 'users' && !action) {
      if (!id) {
        if (method === 'GET') return json(await listUsers(me));
        if (method === 'POST') return json(await createUser(await readBody(request), me), 201);
        throw METHOD_NOT_ALLOWED;
      }
      if (method === 'PUT') return json(await updateUser(id, await readBody(request), me));
      if (method === 'DELETE') {
        await deleteUser(id, me);
        return noContent();
      }
      throw METHOD_NOT_ALLOWED;
    }

    const crud = CRUD[resource];
    if (crud && !action) {
      if (!id) {
        if (method === 'GET') return json(await crud.list());
        if (method === 'POST') return json(await crud.create(await readBody(request)), 201);
        throw METHOD_NOT_ALLOWED;
      }
      if (method === 'PUT') return json(await crud.update(id, await readBody(request)));
      if (method === 'DELETE') {
        await crud.remove(id);
        return noContent();
      }
      throw METHOD_NOT_ALLOWED;
    }

    throw new ApiError(404, 'not_found', 'Rota não encontrada.');
  } catch (error) {
    return errorResponse(error);
  }
}
