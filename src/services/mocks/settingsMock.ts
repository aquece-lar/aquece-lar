import { DEFAULT_NOTES, PAYMENT_TERMS, VALID_DAYS } from '@/config/quotes';
import type { Settings } from '@/types/settings';

/** Ponto de partida: os dados da empresa ficam para o cliente preencher. */
export const SETTINGS_MOCK: Settings = {
  company: { name: 'Aquece Lar', document: '', phone: '', email: '', address: '', footer: '', logo: null },
  quotes: { validDays: VALID_DAYS, paymentTerms: [...PAYMENT_TERMS], notes: DEFAULT_NOTES, maxDiscountPercent: 10 },
};
