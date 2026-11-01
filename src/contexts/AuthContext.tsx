import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { clearSession, login as authenticate, readSession, saveSession } from '@/services/authService';
import type { Session } from '@/types/auth';

interface AuthContextValue {
  session: Session | null;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    const next = await authenticate(username, password);
    saveSession(next, remember);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
