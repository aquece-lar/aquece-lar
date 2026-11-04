import type { Access } from '../../src/types/auth';
import { can, type Permission } from '../../src/lib/access.js';
import { listActivity } from './activity.js';
import { caller, currentUser, forbidden, login, logout } from './auth.js';
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from './customers.js';
import { getDashboard } from './dashboard.js';
import { db } from './db.js';
import { ApiError, errorResponse, json, noContent, readBody } from './http.js';
import { ensureSchema } from './migrate.js';
import { createProduct, deleteProduct, listProducts, updateProduct } from './products.js';
import { changeStatus, createQuote, getQuote, listQuotes, updateQuote } from './quotes.js';
import { createSeller, deleteSeller, listSellers, updateSeller } from './sellers.js';
import { getSettings, saveSettings } from './settings.js';
import { createUser, deleteUser, listUsers, updateUser } from './users.js';

/** `write`/`remove`: permissão para criar e editar / excluir; sem ela, 403. Ler é livre (o filtro fica em `list`). */
type Crud = {
  list: (access: Access) => Promise<unknown>;
  create: (body: Record<string, unknown>, access: Access) => Promise<unknown>;
  update: (id: string, body: Record<string, unknown>, access: Access) => Promise<unknown>;
  remove: (id: string) => Promise<void>;
  write?: Permission;
  removal: Permission;
};

const CRUD: Record<string, Crud> = {
  sellers: {
    list: listSellers,
    create: createSeller,
    update: updateSeller,
    remove: deleteSeller,
    write: 'manageCatalog',
    removal: 'manageCatalog',
  },
  // O vendedor cadastra e edita os próprios clientes (a regra fica em customers.ts), mas não exclui.
  customers: {
    list: listCustomers,
    create: createCustomer,
    update: updateCustomer,
    remove: deleteCustomer,
    removal: 'deleteRecords',
  },
  products: {
    list: listProducts,
    create: createProduct,
    update: updateProduct,
    remove: deleteProduct,
    write: 'manageCatalog',
    removal: 'manageCatalog',
  },
};

function ensure(access: Access, permission: Permission | undefined): void {
  if (permission && !can(access, permission)) throw forbidden();
}

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

    // Banco em dia com o código deste deploy antes de qualquer outra consulta.
    await ensureSchema();

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
      return json(await getDashboard(period(url), me.access));
    }

    if (resource === 'settings' && !id) {
      if (method === 'GET') return json(await getSettings());
      if (method === 'PUT') {
        ensure(me.access, 'manageSystem');
        return json(await saveSettings(await readBody(request), me));
      }
      throw METHOD_NOT_ALLOWED;
    }

    if (resource === 'activity' && !id) {
      if (method !== 'GET') throw METHOD_NOT_ALLOWED;
      ensure(me.access, 'manageSystem');
      return json(await listActivity(url));
    }

    if (resource === 'quotes') {
      if (!id) {
        if (method === 'GET') return json(await listQuotes(period(url), me.access));
        if (method === 'POST') return json(await createQuote(await readBody(request), me), 201);
        throw METHOD_NOT_ALLOWED;
      }
      if (action === 'status') {
        if (method !== 'POST') throw METHOD_NOT_ALLOWED;
        return json(await changeStatus(id, await readBody(request), me));
      }
      if (action) throw new ApiError(404, 'not_found', 'Rota não encontrada.');
      if (method === 'GET') return json(await getQuote(id, me.access));
      if (method === 'PUT') return json(await updateQuote(id, await readBody(request), me));
      throw METHOD_NOT_ALLOWED;
    }

    if (resource === 'users' && !action) {
      ensure(me.access, 'manageSystem');
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
        if (method === 'GET') return json(await crud.list(me.access));
        if (method === 'POST') {
          ensure(me.access, crud.write);
          return json(await crud.create(await readBody(request), me.access), 201);
        }
        throw METHOD_NOT_ALLOWED;
      }
      if (method === 'PUT') {
        ensure(me.access, crud.write);
        return json(await crud.update(id, await readBody(request), me.access));
      }
      if (method === 'DELETE') {
        ensure(me.access, crud.removal);
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
