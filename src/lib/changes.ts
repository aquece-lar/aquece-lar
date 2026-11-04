import type { QuoteDiscount, QuoteDraft, QuoteItem } from '@/types/quotes';
import type { Settings } from '@/types/settings';
import type { UserDraft } from '@/types/users';
import { formatBRL, formatDate } from './format.js';
import { quoteTotals } from './quoteTotals.js';

/**
 * Textos do histórico de alterações: o que mudou entre a versão anterior e a
 * nova, numa linha ("desconto: 5% → 10%; total: R$ 1.000,00 → R$ 950,00").
 * Mesma conta na API e nos dados fictícios. Sem mudança, texto vazio.
 */

function percent(value: number): string {
  return `${String(value).replace('.', ',')}%`;
}

function shown(value: string): string {
  return value.trim() || '—';
}

function join(changes: string[]): string {
  return changes.join('; ');
}

/** "a → b" quando mudou; textos longos só dizem que mudaram. */
function diff(changes: string[], label: string, before: string, after: string, long = false): void {
  if (before === after) return;
  changes.push(long ? `${label} alterado` : `${label}: ${shown(before)} → ${shown(after)}`);
}

export function discountLabel(discount: QuoteDiscount | null): string {
  if (!discount || discount.value === 0) return 'sem desconto';
  return discount.type === 'percent' ? percent(discount.value) : formatBRL(discount.value);
}

/** Compara campo a campo: o JSON do banco não guarda as chaves na mesma ordem. */
function sameItems(a: QuoteItem[], b: QuoteItem[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, i) =>
        item.code === b[i]!.code &&
        item.description === b[i]!.description &&
        item.quantity === b[i]!.quantity &&
        item.unitPrice === b[i]!.unitPrice,
    )
  );
}

export function describeQuoteChanges(before: QuoteDraft, after: QuoteDraft): string {
  const changes: string[] = [];
  diff(changes, 'cliente', before.customerInfo.name, after.customerInfo.name);
  diff(changes, 'vendedor', before.sellerInfo.name, after.sellerInfo.name);
  if (!sameItems(before.items, after.items)) {
    const count = (n: number) => `${n} ${n === 1 ? 'item' : 'itens'}`;
    changes.push(
      before.items.length === after.items.length
        ? 'itens alterados'
        : `itens: ${count(before.items.length)} → ${count(after.items.length)}`,
    );
  }
  diff(changes, 'desconto', discountLabel(before.discount), discountLabel(after.discount));
  const totalBefore = quoteTotals(before.items, before.discount).total;
  const totalAfter = quoteTotals(after.items, after.discount).total;
  if (totalBefore !== totalAfter) changes.push(`total: ${formatBRL(totalBefore)} → ${formatBRL(totalAfter)}`);
  if (before.validUntil !== after.validUntil) {
    changes.push(`validade: ${formatDate(before.validUntil)} → ${formatDate(after.validUntil)}`);
  }
  diff(changes, 'pagamento', before.paymentTerms, after.paymentTerms);
  if (before.notes !== after.notes) changes.push('observações alteradas');
  return join(changes);
}

export function describeSettingsChanges(before: Settings, after: Settings): string {
  const changes: string[] = [];
  const [a, b] = [before.company, after.company];
  diff(changes, 'nome da empresa', a.name, b.name);
  diff(changes, 'CNPJ', a.document, b.document);
  diff(changes, 'telefone', a.phone, b.phone);
  diff(changes, 'e-mail', a.email, b.email);
  diff(changes, 'endereço', a.address, b.address, true);
  if (a.logo !== b.logo) changes.push(b.logo ? (a.logo ? 'logo trocado' : 'logo incluído') : 'logo removido');
  diff(changes, 'rodapé do PDF', a.footer, b.footer, true);
  const [q, r] = [before.quotes, after.quotes];
  const days = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
  diff(changes, 'validade padrão', days(q.validDays), days(r.validDays));
  if (q.paymentTerms.join('\n') !== r.paymentTerms.join('\n')) {
    const first = (terms: string[]) => shown(terms[0] ?? '');
    changes.push(
      first(q.paymentTerms) === first(r.paymentTerms)
        ? 'condições de pagamento alteradas'
        : `pagamento padrão: ${first(q.paymentTerms)} → ${first(r.paymentTerms)}`,
    );
  }
  diff(changes, 'observações padrão', q.notes, r.notes, true);
  const limit = (n: number | null) => (n === null ? 'sem limite' : percent(n));
  diff(changes, 'desconto máximo', limit(q.maxDiscountPercent), limit(r.maxDiscountPercent));
  diff(changes, 'aviso de vencimento', days(q.expiryAlertDays), days(r.expiryAlertDays));
  return join(changes);
}

/** O que o histórico precisa saber do usuário antes da edição. */
export interface UserSnapshot extends Omit<UserDraft, 'password'> {
  sellerName: string | null;
}

export function describeUserChanges(before: UserSnapshot, after: UserSnapshot, passwordChanged: boolean): string {
  const changes: string[] = [];
  diff(changes, 'nome', before.name, after.name);
  diff(changes, 'e-mail', before.email, after.email);
  diff(changes, 'perfil', before.role, after.role);
  diff(changes, 'vendedor ligado', before.sellerName ?? '', after.sellerName ?? '');
  const onOff = (on: boolean) => (on ? 'sim' : 'não');
  diff(changes, 'vê de todos', onOff(before.seeAll), onOff(after.seeAll));
  diff(changes, 'passa do desconto', onOff(before.exceedDiscount), onOff(after.exceedDiscount));
  if (passwordChanged) changes.push('senha trocada');
  return join(changes);
}
