/** Validade padrão de um orçamento, em dias a partir da criação. */
export const VALID_DAYS = 15;

export const PAYMENT_TERMS = ['À vista com 5% de desconto', '3x sem juros no cartão', 'Entrada + 2x no boleto'];

/** Percentual que a condição de pagamento promete ("… 5% de desconto"), ou `null`. */
export function termDiscount(terms: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*%\s*de\s+desconto/i.exec(terms);
  return match?.[1] ? Number(match[1].replace(',', '.')) : null;
}

export const DEFAULT_WHATSAPP_MESSAGE =
  'Olá, {cliente}! Segue o orçamento {numero} da {empresa}, no valor de {total}, válido até {validade}. ' +
  'Qualquer dúvida, estou à disposição. {vendedor}';

export const DEFAULT_NOTES =
  'Prazo de entrega de 7 a 10 dias úteis após a aprovação. Instalação agendada conforme disponibilidade.';
