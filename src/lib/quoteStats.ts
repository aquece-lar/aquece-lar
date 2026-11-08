import type { Quote } from '@/types/quotes';

/** Números da ficha do cliente ou do vendedor, calculados sobre os orçamentos dele. */
export interface QuoteStats {
  count: number;
  total: number;
  approvedCount: number;
  approvedTotal: number;
  /** Pendentes e enviados: o que ainda pode virar venda. */
  openCount: number;
  openTotal: number;
  /** Aprovados + cancelados: os que já tiveram resposta. */
  decided: number;
  /** Aprovados ÷ decididos, de 0 a 100; `null` enquanto nenhum foi decidido. */
  approvalRate: number | null;
}

export function quoteStats(quotes: readonly Quote[]): QuoteStats {
  const sum = (list: readonly Quote[]) => list.reduce((total, q) => total + q.amount, 0);
  const approved = quotes.filter((q) => q.status === 'Aprovado');
  const open = quotes.filter((q) => q.status === 'Pendente' || q.status === 'Enviado');
  const decided = approved.length + quotes.filter((q) => q.status === 'Cancelado').length;
  return {
    count: quotes.length,
    total: sum(quotes),
    approvedCount: approved.length,
    approvedTotal: sum(approved),
    openCount: open.length,
    openTotal: sum(open),
    decided,
    approvalRate: decided === 0 ? null : Math.round((approved.length / decided) * 100),
  };
}
