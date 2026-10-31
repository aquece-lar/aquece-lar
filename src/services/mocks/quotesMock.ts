import type { QuoteStatus } from '@/types/dashboard';
import type { Quote } from '@/types/quotes';
import { VALID_DAYS } from '@/config/quotes';
import { toISODate } from '@/lib/format';
import { CUSTOMERS_MOCK, SELLERS_MOCK } from './peopleMock';

/**
 * As datas dos mocks andam junto com o relógio: o mais recente é de ontem e
 * o histórico cobre os últimos ~5 meses. Assim o dashboard do mês corrente
 * nunca fica vazio, seja qual for o dia em que o app é aberto.
 */
const HISTORY_DAYS = 150;

/** Orçamentos por dia, indexados pelo dia do mês (1 a 30). */
const DAILY_PATTERN = [2, 3, 1, 0, 3, 2, 3, 4, 2, 1, 0, 3, 3, 4, 2, 3, 1, 0, 4, 3, 4, 3, 2, 1, 0, 3, 4, 3, 5, 2];

const STATUS_CYCLE: QuoteStatus[] = ['Aprovado', 'Enviado', 'Aprovado', 'Cancelado', 'Pendente', 'Aprovado', 'Enviado'];

/** Data/hora ISO de `days` dias atrás, no horário local informado. */
function daysAgo(days: number, hours: number, minutes: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hours, minutes).toISOString();
}

/** Validade padrão contada a partir do dia (local) da criação. */
function validFrom(createdAt: string): string {
  const created = new Date(createdAt);
  return toISODate(new Date(created.getFullYear(), created.getMonth(), created.getDate() + VALID_DAYS));
}

/** Os 10 mais recentes, de 1 a 4 dias atrás; os testes e links de exemplo usam estes números. */
const RECENT: Array<[number: number, customer: string, seller: string, amount: number, status: QuoteStatus, days: number, time: string]> = [
  [1181, 'Restaurante Brasa Viva', 'Carlos Menezes', 18940, 'Pendente', 1, '09:42'],
  [1180, 'Marcos Andrade', 'Patrícia Lima', 7380, 'Enviado', 2, '18:15'],
  [1179, 'Condomínio Vale Verde', 'Rafael Bortolini', 32410, 'Aprovado', 2, '16:03'],
  [1178, 'Juliana Teixeira', 'Aline Costa', 5920, 'Enviado', 2, '11:27'],
  [1177, 'Pousada Recanto da Serra', 'Carlos Menezes', 24750, 'Pendente', 2, '10:08'],
  [1176, 'Ricardo Moretto', 'Diego Ferraz', 9860, 'Aprovado', 3, '17:51'],
  [1175, 'Espaço Gourmet Bento', 'Patrícia Lima', 15230, 'Cancelado', 3, '14:36'],
  [1174, 'Ana Paula Ribeiro', 'Tatiane Rocha', 6480, 'Enviado', 3, '09:12'],
  [1173, 'Clube Recreativo Serrano', 'Rafael Bortolini', 41200, 'Pendente', 4, '19:40'],
  [1172, 'Felipe Zanella', 'Aline Costa', 8150, 'Aprovado', 4, '15:22'],
];

function buildRecent(): Quote[] {
  return RECENT.map(([number, customer, seller, amount, status, days, time]) => {
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    const createdAt = daysAgo(days, hours, minutes);
    return { id: String(number), number: `#${number}`, customer, seller, amount, status, createdAt, validUntil: validFrom(createdAt) };
  });
}

/**
 * Os anteriores (#1171 para trás) são gerados de forma determinística: a
 * quantidade de cada dia segue DAILY_PATTERN e a numeração cresce com o tempo.
 */
function buildOlder(): Quote[] {
  const customers = CUSTOMERS_MOCK.map((c) => c.name);
  const sellers = SELLERS_MOCK.filter((s) => s.status === 'Ativo').map((s) => s.name);
  const slots: Array<{ days: number; slot: number }> = [];
  const now = new Date();
  for (let days = 5; days <= HISTORY_DAYS; days++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    const count = DAILY_PATTERN[(date.getDate() - 1) % DAILY_PATTERN.length] ?? 0;
    for (let slot = 0; slot < count; slot++) slots.push({ days, slot });
  }

  // `slots` vai do mais novo para o mais antigo; o mais novo recebe o #1171.
  return slots.map(({ days, slot }, i) => {
    const number = 1171 - i;
    // Os do mesmo dia ficam espaçados ao longo do expediente, o último antes das 19h.
    const createdAt = daysAgo(days, 18 - slot * 2, (number * 37) % 60);
    return {
      id: String(number),
      number: `#${number}`,
      customer: customers[(number * 5) % customers.length] ?? '',
      seller: sellers[(number * 7 + 1) % sellers.length] ?? '',
      amount: 4200 + ((number * 7919) % 380) * 100,
      status: STATUS_CYCLE[number % STATUS_CYCLE.length] ?? 'Enviado',
      createdAt,
      validUntil: validFrom(createdAt),
    };
  });
}

export const QUOTES_MOCK: Quote[] = [...buildRecent(), ...buildOlder()];
