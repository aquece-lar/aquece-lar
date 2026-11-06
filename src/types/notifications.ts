/**
 * Aviso para quem está conectado: orçamentos vencendo e enviados esperando
 * retorno; o formato é genérico para outros tipos (ex.: avisos da IA) entrarem depois.
 */
export interface Notification {
  /** Estável enquanto o aviso é o mesmo; serve para marcar como visto. */
  id: string;
  kind: 'quote_expiring' | 'quote_follow_up';
  /** Ex.: "#1142 vence hoje", "#1142 sem resposta há 4 dias". */
  title: string;
  /** Ex.: "Hotel Bella Vista · Aline Costa · R$ 30.000,00". */
  message: string;
  /** Rota do app que o aviso abre. */
  link: string;
  /**
   * Dados do orçamento, para quem consome a API (ex.: a IA) não precisar ler o texto.
   * `days`: dias até vencer (`quote_expiring`) ou desde o envio (`quote_follow_up`).
   */
  quote: { id: string; number: string; customer: string; seller: string; amount: number; validUntil: string; days: number };
}
