import type { IconName } from '@/components/Icon';
import type { Permission } from '@/lib/access';

export interface NavItem {
  label: string;
  icon: IconName;
  to: string;
  /** Só aparece (e só abre) para quem tem a permissão. */
  permission?: Permission;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    title: 'Comercial',
    items: [
      { label: 'Dashboard', icon: 'grid', to: '/' },
      { label: 'Orçamentos', icon: 'file', to: '/orcamentos' },
      { label: 'Vendedores', icon: 'user', to: '/vendedores', permission: 'viewSellers' },
      { label: 'Clientes', icon: 'users', to: '/clientes' },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { label: 'Produtos', icon: 'box', to: '/produtos' },
    ],
  },
  {
    title: 'Atendimento / Bot',
    items: [
      { label: 'Fluxogramas', icon: 'flow', to: '/fluxogramas' },
      { label: 'Conversas', icon: 'chat', to: '/conversas' },
      { label: 'Equivalências', icon: 'swap', to: '/equivalencias' },
    ],
  },
  {
    title: 'Sistema',
    items: [{ label: 'Configurações', icon: 'sliders', to: '/configuracoes', permission: 'manageSystem' }],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAVIGATION.flatMap((section) => section.items);
