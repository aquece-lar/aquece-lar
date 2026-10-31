import type { IconName } from '@/components/Icon';

export interface NavItem {
  label: string;
  icon: IconName;
  to: string;
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
      { label: 'Vendedores', icon: 'user', to: '/vendedores' },
      { label: 'Clientes', icon: 'users', to: '/clientes' },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { label: 'Produtos', icon: 'box', to: '/produtos' },
      { label: 'Linhas e códigos', icon: 'layers', to: '/linhas' },
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
    items: [{ label: 'Configurações', icon: 'sliders', to: '/configuracoes' }],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAVIGATION.flatMap((section) => section.items);
