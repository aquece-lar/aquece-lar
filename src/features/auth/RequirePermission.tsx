import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCan } from '@/contexts/AuthContext';
import type { Permission } from '@/lib/access';

/** Tela que o perfil não pode abrir (ex.: link salvo): volta para o dashboard. A API também recusa. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const allowed = useCan(permission);
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}
