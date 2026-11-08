/** Onde a alteração aconteceu. */
export type ActivityArea = 'Orçamentos' | 'Clientes' | 'Vendedores' | 'Produtos' | 'Configurações' | 'Usuários';

export const ACTIVITY_AREAS: readonly ActivityArea[] = [
  'Orçamentos',
  'Clientes',
  'Vendedores',
  'Produtos',
  'Configurações',
  'Usuários',
];

/** As que ficam em activity_log; os orçamentos vêm de quote_events. */
export type LoggedArea = Exclude<ActivityArea, 'Orçamentos'>;

/** Uma linha do histórico de alterações (Configurações → Histórico). */
export interface Activity {
  id: string;
  /** Data/hora ISO. */
  at: string;
  /** Quem fez; `null` quando não se sabe (eventos antigos). */
  by: string | null;
  area: ActivityArea;
  /** O que foi feito, ex.: "Orçamento #1181 editado". */
  summary: string;
  /** O que mudou, ex.: "desconto: 5% → 10%"; pode ficar vazio. */
  detail: string;
  /** Orçamento a que se refere, para o link; `null` nas outras áreas. */
  quoteId: string | null;
  /** Resumo do orçamento como está hoje (vendedor, cliente e valor); `null` nas outras áreas. */
  quote: ActivityQuote | null;
}

export interface ActivityQuote {
  seller: string;
  customer: string;
  amount: number;
}

/** Quantas linhas o histórico mostra, das mais recentes. */
export const ACTIVITY_LIMIT = 300;
