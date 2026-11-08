import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QuoteProfile } from '@/features/people/QuoteProfile';
import { useList } from '@/features/people/useList';
import { customerHistory, listCustomers } from '@/services/peopleService';
import listStyles from './ListPage.module.css';

/** Ficha do cliente (/clientes/:id): números e todos os orçamentos dele. */
export function CustomerProfilePage() {
  const { id = '' } = useParams();
  const list = useList(listCustomers, 'Não foi possível carregar os clientes.');
  const customer = list.data?.find((c) => c.id === id) ?? null;
  const load = useCallback((signal: AbortSignal) => customerHistory(id, signal), [id]);

  return (
    <QuoteProfile
      back={{ to: '/clientes', label: 'Clientes' }}
      name={customer?.name ?? null}
      details={
        customer ? [customer.document, customer.phone, customer.city, customer.seller && `Vendedor: ${customer.seller}`] : []
      }
      badge={
        customer && (
          <span className={`${listStyles.badge} ${customer.kind === 'PJ' ? listStyles.info : listStyles.brand}`}>
            {customer.kind === 'PJ' ? 'Empresa' : 'Pessoa'}
          </span>
        )
      }
      missing={list.status === 'success' && !customer}
      missingText="Cliente não encontrado"
      load={load}
      hide="customer"
    />
  );
}
