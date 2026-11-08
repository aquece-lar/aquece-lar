import type { LoggedArea } from '../../src/types/activity';
import type { Access } from '../../src/types/auth';
import { describeCustomerChanges, describeProductChanges, describeSellerChanges } from '../../src/lib/changes.js';
import { can, type Permission } from '../../src/lib/access.js';
import { deleteActivity, listActivity, logActivity } from './activity.js';
import { caller, currentUser, forbidden, login, logout, type Caller } from './auth.js';
import { createCustomer, deleteCustomer, getCustomer, listCustomers, updateCustomer } from './customers.js';
import { getDashboard } from './dashboard.js';
import { db } from './db.js';
import { dismissNotifications, listNotifications } from './notifications.js';
import { ApiError, errorResponse, json, noContent, readBody } from './http.js';
import { ensureSchema } from './migrate.js';
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from './products.js';
import {
  cancelQuotes,
  reopenQuotes,
  changeStatus,
  createQuote,
  deleteCancelledQuotes,
  deleteQuote,
  getQuote,
  listQuotes,
  quoteHistory,
  updateQuote,
} from './quotes.js';
import { createSeller, deleteSeller, getSeller, listSellers, updateSeller } from './sellers.js';
import { getSettings, saveSettings } from './settings.js';
import { createUser, deleteUser, listUsers, updateUser } from './users.js';

/** `write`/`remove`: permissão para criar e editar / excluir; sem ela, 403. Ler é livre (o filtro fica em `list`). */
type Crud = {
  list: (access: Access) => Promise<unknown>;
  create: (body: Record<string, unknown>, me: Caller) => Promise<unknown>;
  update: (id: string, body: Record<string, unknown>, me: Caller) => Promise<unknown>;
  remove: (id: string, me: Caller) => Promise<void>;
  write?: Permission;
  removal: Permission;
};

/** Cadastro com histórico: cada criação, edição (com o que mudou) e exclusão vai para o activity_log. */
function logged<T>(c: {
  list: (access: Access) => Promise<unknown>;
  create: (body: Record<string, unknown>, access: Access) => Promise<T>;
  update: (id: string, body: Record<string, unknown>, access: Access) => Promise<T>;
  remove: (id: string) => Promise<void>;
  get: (id: string) => Promise<T>;
  write?: Permission;
  removal: Permission;
  area: LoggedArea;
  /** "Cliente Ana", "Produto AQG-20D". */
  title: (item: T) => string;
  changes: (before: T, after: T) => string;
}): Crud {
  return {
    list: c.list,
    write: c.write,
    removal: c.removal,
    async create(body, me) {
      const item = await c.create(body, me.access);
      await logActivity(me, c.area, `${c.title(item)} cadastrado`);
      return item;
    },
    async update(id, body, me) {
      const before = await c.get(id);
      const after = await c.update(id, body, me.access);
      const detail = c.changes(before, after);
      if (detail) await logActivity(me, c.area, `${c.title(after)} editado`, detail);
      return after;
    },
    async remove(id, me) {
      const before = await c.get(id);
      await c.remove(id);
      await logActivity(me, c.area, `${c.title(before)} excluído`);
    },
  };
}

const CRUD: Record<string, Crud> = {
  sellers: logged({
    list: listSellers,
    create: createSeller,
    update: updateSeller,
    remove: deleteSeller,
    get: getSeller,
    write: 'manageCatalog',
    removal: 'manageCatalog',
    area: 'Vendedores',
    title: (s) => `Vendedor ${s.name}`,
    changes: describeSellerChanges,
  }),
  // O vendedor cadastra e edita os próprios clientes (a regra fica em customers.ts), mas não exclui.
  customers: logged({
    list: listCustomers,
    create: createCustomer,
    update: updateCustomer,
    remove: deleteCustomer,
    get: getCustomer,
    removal: 'deleteRecords',
    area: 'Clientes',
    title: (c) => `Cliente ${c.name}`,
    changes: describeCustomerChanges,
  }),
  products: logged({
    list: listProducts,
    create: createProduct,
    update: updateProduct,
    remove: deleteProduct,
    get: getProduct,
    write: 'manageCatalog',
    removal: 'manageCatalog',
    area: 'Produtos',
    title: (p) => `Produto ${p.code}`,
    changes: describeProductChanges,
  }),
};

function ensure(access: Access, permission: Permission | undefined): void {
  if (permission && !can(access, permission)) throw forbidden();
}

const METHOD_NOT_ALLOWED = new ApiError(405, 'method_not_allowed', 'Método não permitido.');

/** `{ ids: ["12", "13"] }` com ids numéricos, até 500 por vez. */
function readQuoteIds(body: Record<string, unknown>): string[] {
  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || ids.some((id) => typeof id !== 'string' || !/^\d+$/.test(id))) {
    throw new ApiError(400, 'validation', 'Escolha os orçamentos a excluir.');
  }
  return ids as string[];
}

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

    // Cancelar em lote: `{ ids, delete? }`; com `delete`, já apaga de vez.
    if (resource === 'quotes' && id === 'cancel' && !action && rest.length === 0) {
      if (method !== 'POST') throw METHOD_NOT_ALLOWED;
      const body = await readBody(request);
      return json(await cancelQuotes(readQuoteIds(body), body.delete === true, me));
    }

    // Reabrir em lote: `{ ids }`; os cancelados voltam para pendente.
    if (resource === 'quotes' && id === 'reopen' && !action && rest.length === 0) {
      if (method !== 'POST') throw METHOD_NOT_ALLOWED;
      return json(await reopenQuotes(readQuoteIds(await readBody(request)), me));
    }

    // Ids são numéricos; qualquer outra coisa não existe.
    if (rest.length > 0 || (id !== undefined && !/^\d+$/.test(id))) throw new ApiError(404, 'not_found', 'Rota não encontrada.');

    if (resource === 'dashboard' && !id) {
      if (method !== 'GET') throw METHOD_NOT_ALLOWED;
      return json(await getDashboard(period(url), me.access));
    }

    if (resource === 'notifications' && !id) {
      if (method === 'GET') return json(await listNotifications(me));
      if (method === 'DELETE') return json(await dismissNotifications(await readBody(request), me));
      throw METHOD_NOT_ALLOWED;
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
      ensure(me.access, 'manageSystem');
      if (method === 'GET') return json(await listActivity(url));
      if (method === 'DELETE') return json(await deleteActivity(await readBody(request), me));
      throw METHOD_NOT_ALLOWED;
    }

    if (resource === 'quotes') {
      if (!id) {
        if (method === 'GET') return json(await listQuotes(period(url), me.access));
        if (method === 'POST') return json(await createQuote(await readBody(request), me), 201);
        if (method === 'DELETE') {
          ensure(me.access, 'deleteRecords');
          return json(await deleteCancelledQuotes(readQuoteIds(await readBody(request)), me));
        }
        throw METHOD_NOT_ALLOWED;
      }
      if (action === 'status') {
        if (method !== 'POST') throw METHOD_NOT_ALLOWED;
        return json(await changeStatus(id, await readBody(request), me));
      }
      if (action) throw new ApiError(404, 'not_found', 'Rota não encontrada.');
      if (method === 'GET') return json(await getQuote(id, me.access));
      if (method === 'PUT') return json(await updateQuote(id, await readBody(request), me));
      if (method === 'DELETE') {
        ensure(me.access, 'deleteRecords');
        await deleteQuote(id, me);
        return noContent();
      }
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

    // Ficha do cliente ou do vendedor (a tela de vendedores é só de quem pode vê-la).
    if ((resource === 'customers' || resource === 'sellers') && id && action === 'quotes') {
      if (method !== 'GET') throw METHOD_NOT_ALLOWED;
      if (resource === 'sellers') ensure(me.access, 'viewSellers');
      return json(await quoteHistory(resource === 'customers' ? 'customer' : 'seller', id, me.access));
    }

    const crud = CRUD[resource];
    if (crud && !action) {
      if (!id) {
        if (method === 'GET') return json(await crud.list(me.access));
        if (method === 'POST') {
          ensure(me.access, crud.write);
          return json(await crud.create(await readBody(request), me), 201);
        }
        throw METHOD_NOT_ALLOWED;
      }
      if (method === 'PUT') {
        ensure(me.access, crud.write);
        return json(await crud.update(id, await readBody(request), me));
      }
      if (method === 'DELETE') {
        ensure(me.access, crud.removal);
        await crud.remove(id, me);
        return noContent();
      }
      throw METHOD_NOT_ALLOWED;
    }

    throw new ApiError(404, 'not_found', 'Rota não encontrada.');
  } catch (error) {
    return errorResponse(error);
  }
}
