import type { Settings } from '@/types/settings';
import { MAX_WHATSAPP_MESSAGE } from './whatsapp.js';

export const MAX_VALID_DAYS = 365;
export const MAX_ALERT_DAYS = 60;

/**
 * Regras das configurações, as mesmas no front e na API (api/_lib).
 * Devolve a mensagem do primeiro problema, ou `null` se estiver tudo certo.
 */
export function settingsProblem(next: Settings): string | null {
  if (!next.company.name.trim()) return 'Informe o nome da empresa.';
  const days = next.quotes.validDays;
  if (!Number.isInteger(days) || days < 1 || days > MAX_VALID_DAYS) {
    return `A validade deve ser de 1 a ${MAX_VALID_DAYS} dias.`;
  }
  if (next.quotes.paymentTerms.length === 0) return 'Informe ao menos uma condição de pagamento.';
  const limit = next.quotes.maxDiscountPercent;
  if (limit !== null && (!Number.isFinite(limit) || limit < 0 || limit > 100)) {
    return 'O desconto máximo deve ser de 0 a 100%.';
  }
  const alert = next.quotes.expiryAlertDays;
  if (!Number.isInteger(alert) || alert < 0 || alert > MAX_ALERT_DAYS) {
    return `O aviso de vencimento deve ser de 0 a ${MAX_ALERT_DAYS} dias.`;
  }
  const followUp = next.quotes.followUpDays;
  if (!Number.isInteger(followUp) || followUp < 0 || followUp > MAX_ALERT_DAYS) {
    return `O lembrete de retorno deve ser de 0 a ${MAX_ALERT_DAYS} dias.`;
  }
  const message = next.quotes.whatsappMessage.trim();
  if (!message) return 'Escreva a mensagem do WhatsApp.';
  if (message.length > MAX_WHATSAPP_MESSAGE) return `A mensagem do WhatsApp pode ter no máximo ${MAX_WHATSAPP_MESSAGE} caracteres.`;
  return null;
}
