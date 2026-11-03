import type { Settings } from '../../src/types/settings';
import { DEFAULT_NOTES, PAYMENT_TERMS, VALID_DAYS } from '../../src/config/quotes.js';
import { settingsProblem } from '../../src/lib/settingsRules.js';
import { db } from './db.js';
import { invalid } from './http.js';

/** Enquanto ninguém salvou, as configurações são as mesmas do modo fictício. */
const DEFAULTS: Settings = {
  company: { name: 'Aquece Lar', document: '', phone: '', email: '', address: '', footer: '', logo: null },
  quotes: { validDays: VALID_DAYS, paymentTerms: [...PAYMENT_TERMS], notes: DEFAULT_NOTES, maxDiscountPercent: 10, expiryAlertDays: 3 },
};

export async function getSettings(): Promise<Settings> {
  const [row] = await db()`select data from settings where id = 1`;
  return (row?.data as Settings | undefined) ?? DEFAULTS;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Monta o objeto só com os campos conhecidos, para não guardar nada a mais. */
function readSettings(body: Record<string, unknown>): Settings {
  const company = (body.company ?? {}) as Record<string, unknown>;
  const quotes = (body.quotes ?? {}) as Record<string, unknown>;
  const terms = Array.isArray(quotes.paymentTerms) ? quotes.paymentTerms : [];
  const limit = quotes.maxDiscountPercent;
  return {
    company: {
      name: str(company.name).trim(),
      document: str(company.document).trim(),
      phone: str(company.phone).trim(),
      email: str(company.email).trim(),
      address: str(company.address).trim(),
      footer: str(company.footer),
      logo: typeof company.logo === 'string' && company.logo ? company.logo : null,
    },
    quotes: {
      validDays: Number(quotes.validDays),
      paymentTerms: terms.map(str).map((t) => t.trim()).filter(Boolean),
      notes: str(quotes.notes),
      maxDiscountPercent: limit === null ? null : Number(limit),
      expiryAlertDays: Number(quotes.expiryAlertDays),
    },
  };
}

export async function saveSettings(body: Record<string, unknown>): Promise<Settings> {
  const next = readSettings(body);
  const problem = settingsProblem(next);
  if (problem) throw invalid(problem);
  const [row] = await db()`
    insert into settings (id, data) values (1, ${JSON.stringify(next)}::jsonb)
    on conflict (id) do update set data = excluded.data
    returning data`;
  return row!.data as Settings;
}
