import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { can, FULL_ACCESS, type Permission } from '@/lib/access';
import { currentSession, login as authenticate, logout as endSession } from '@/services/authService';
import { SESSION_EXPIRED_EVENT } from '@/services/http';
import type { Access, Session } from '@/types/auth';

interface AuthContextValue {
  /** `undefined` enquanto confere se já há sessão. */
  session: Session | null | undefined;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  /** Busca de novo quem está conectado (ex.: depois de mudar o próprio nome). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    currentSession(controller.signal)
      .then(setSession)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Não foi possível conferir a sessão', error);
        setSession(null);
      });
    return () => controller.abort();
  }, []);

  // Qualquer chamada recusada por sessão vencida devolve para o login.
  useEffect(() => {
    const expire = () => setSession(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    setSession(await authenticate(email, password, remember));
  }, []);

  const logout = useCallback(async () => {
    try {
      await endSession();
    } catch (error) {
      console.error('Falha ao sair', error);
    }
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSession(await currentSession());
    } catch (error) {
      console.error('Não foi possível atualizar a sessão', error);
    }
  }, []);

  const value = useMemo(() => ({ session, login, logout, refresh }), [session, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Nome, e-mail e iniciais de quem está conectado; fora do AuthProvider (testes), "Administrador". */
export function useUserName(): { name: string; email: string; initials: string } {
  const session = useContext(AuthContext)?.session;
  const name = session?.name || 'Administrador';
  const email = session?.email ?? '';
  const words = name.trim().split(/\s+/);
  const initials = (words.length > 1 ? words[0]![0]! + words[words.length - 1]![0]! : name.slice(0, 2)).toUpperCase();
  return { name, email, initials };
}

/** `logout` do AuthContext; fora do AuthProvider (testes de tela), não faz nada. */
export function useLogout(): () => Promise<void> {
  return useContext(AuthContext)?.logout ?? noop;
}

/** Perfil de quem está conectado; fora do AuthProvider (testes de tela), acesso total. */
export function useAccess(): Access {
  return useContext(AuthContext)?.session?.access ?? FULL_ACCESS;
}

/** Atalho para esconder menus e botões que o perfil não pode usar (a API confere de novo). */
export function useCan(permission: Permission): boolean {
  return can(useAccess(), permission);
}

/** `refresh` do AuthContext; fora do AuthProvider (testes de tela), não faz nada. */
export function useRefreshSession(): () => Promise<void> {
  return useContext(AuthContext)?.refresh ?? noop;
}

const noop = async () => {};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
