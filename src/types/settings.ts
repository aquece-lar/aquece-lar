/** Dados da empresa que aparecem no cabeçalho do PDF do orçamento. */
export interface CompanyInfo {
  name: string;
  /** CNPJ como digitado; pode ficar vazio. */
  document: string;
  phone: string;
  email: string;
  address: string;
  /** Texto livre no fim do PDF (PIX, dados bancários, garantia); quebras de linha são mantidas. */
  footer: string;
  /** Logo como data URL (PNG reduzido), ou `null`. */
  logo: string | null;
}

/** Valores com que um orçamento novo começa. */
export interface QuoteDefaults {
  /** Validade em dias a partir da criação. */
  validDays: number;
  /** Condições oferecidas; a primeira é a padrão. "… X% de desconto" no texto sugere o desconto. */
  paymentTerms: string[];
  notes: string;
  /** Desconto máximo, em % do subtotal, sem pedir confirmação; `null` é sem limite. */
  maxDiscountPercent: number | null;
}

export interface Settings {
  company: CompanyInfo;
  quotes: QuoteDefaults;
}
