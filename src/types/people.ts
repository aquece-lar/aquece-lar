export type SellerStatus = 'Ativo' | 'Inativo';

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  region: string;
  status: SellerStatus;
  /** Meta mensal de valor orçado; `null` = sem meta. */
  monthlyGoal: number | null;
  /** Orçamentos emitidos no mês corrente. */
  quotes: number;
  /** Valor orçado no mês corrente. */
  amount: number;
}

export type CustomerKind = 'PF' | 'PJ';

export interface Customer {
  id: string;
  name: string;
  kind: CustomerKind;
  /** CPF ou CNPJ já formatado. */
  document: string;
  phone: string;
  city: string;
  seller: string;
  quotes: number;
  /** Data/hora ISO do último orçamento; `null` se ainda não houver. */
  lastQuoteAt: string | null;
}
