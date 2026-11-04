import type { QuoteStatus, RecentQuote } from './dashboard';

/** Orçamento na listagem; mesmo formato da tabela do dashboard. */
export type Quote = RecentQuote;

export interface QuoteItem {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteEvent {
  status: QuoteStatus;
  /** Data/hora ISO. */
  at: string;
  note: string;
  /** Quem fez (nome do usuário); `null` em eventos de antes do histórico guardar o autor. */
  by: string | null;
  /** O que mudou numa edição (ex.: "desconto: 5% → 10%"); vazio nos outros eventos. */
  detail: string;
}

export interface QuoteContact {
  name: string;
  /** Linha secundária: documento do cliente ou e-mail do vendedor. */
  detail: string;
  phone: string;
  city?: string;
}

export interface QuoteDetail extends Quote {
  customerInfo: QuoteContact;
  sellerInfo: QuoteContact;
  items: QuoteItem[];
  paymentTerms: string;
  /** Desconto sobre a soma dos itens; `null` = sem desconto. */
  discount: QuoteDiscount | null;
  notes: string;
  history: QuoteEvent[];
}

export interface QuoteDiscount {
  type: 'percent' | 'amount';
  /** Percentual (0–100) ou valor em reais, conforme `type`. */
  value: number;
}

/** O que o formulário envia; número, data, status, total e histórico vêm do serviço. */
export type QuoteDraft = Pick<
  QuoteDetail,
  'customerInfo' | 'sellerInfo' | 'items' | 'validUntil' | 'paymentTerms' | 'discount' | 'notes'
>;

export interface CatalogProduct {
  code: string;
  description: string;
  /** Preço de tabela; pode ser ajustado em cada orçamento. */
  unitPrice: number;
}
