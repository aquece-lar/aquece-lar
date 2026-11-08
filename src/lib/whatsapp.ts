import type { Quote, QuoteContact } from '@/types/quotes';
import { formatBRL, formatDate } from './format.js';

export const MAX_WHATSAPP_MESSAGE = 1000;

/** Campos que a mensagem padrão pode usar; cada `{campo}` vira o dado do orçamento. */
export const WHATSAPP_FIELDS = [
  { key: 'cliente', label: 'nome do cliente' },
  { key: 'numero', label: 'número do orçamento' },
  { key: 'total', label: 'valor total' },
  { key: 'validade', label: 'válido até' },
  { key: 'vendedor', label: 'nome do vendedor' },
  { key: 'empresa', label: 'nome da empresa' },
] as const;

type Field = (typeof WHATSAPP_FIELDS)[number]['key'];

export interface WhatsappData {
  quote: Pick<Quote, 'number' | 'amount' | 'validUntil'>;
  customer: Pick<QuoteContact, 'name'>;
  seller: Pick<QuoteContact, 'name'>;
  company: string;
}

/** Troca cada `{campo}` pelo dado; um campo desconhecido fica como está, para a pessoa ver o erro. */
export function fillWhatsappMessage(template: string, data: WhatsappData): string {
  const values: Record<Field, string> = {
    cliente: data.customer.name,
    numero: data.quote.number,
    total: formatBRL(data.quote.amount),
    validade: formatDate(data.quote.validUntil),
    vendedor: data.seller.name,
    empresa: data.company,
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key as Field] : match));
}

/**
 * Link do WhatsApp com a mensagem pronta. Telefone brasileiro sem DDI (10 ou
 * 11 dígitos) ganha o 55; sem telefone, o WhatsApp abre para escolher o contato.
 */
export function whatsappLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
