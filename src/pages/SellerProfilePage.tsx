import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QuoteProfile } from '@/features/people/QuoteProfile';
import { useList } from '@/features/people/useList';
import { listSellers, sellerHistory } from '@/services/peopleService';
import listStyles from './ListPage.module.css';

/** Ficha do vendedor (/vendedores/:id): números e todos os orçamentos dele. */
export function SellerProfilePage() {
  const { id = '' } = useParams();
  const list = useList(listSellers, 'Não foi possível carregar os vendedores.');
  const seller = list.data?.find((s) => s.id === id) ?? null;
  const load = useCallback((signal: AbortSignal) => sellerHistory(id, signal), [id]);

  return (
    <QuoteProfile
      back={{ to: '/vendedores', label: 'Vendedores' }}
      name={seller?.name ?? null}
      details={seller ? [seller.email, seller.phone, seller.region] : []}
      badge={
        seller && (
          <span className={`${listStyles.badge} ${seller.status === 'Ativo' ? listStyles.ok : listStyles.off}`}>
            {seller.status}
          </span>
        )
      }
      missing={list.status === 'success' && !seller}
      missingText="Vendedor não encontrado"
      load={load}
      hide="seller"
    />
  );
}
