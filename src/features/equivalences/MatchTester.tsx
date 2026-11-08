import { useId, useState } from 'react';
import { Icon } from '@/components/Icon';
import { findProducts } from '@/lib/equivalence';
import type { Equivalence } from '@/types/equivalences';
import styles from './MatchTester.module.css';

/** Digita uma frase como o cliente escreveria e vê quais produtos as equivalências encontram (a regra do bot). */
export function MatchTester({ equivalences }: { equivalences: readonly Equivalence[] }) {
  const [text, setText] = useState('');
  const id = useId();
  const found = findProducts(text, equivalences);

  return (
    <section className={`card ${styles.card}`} aria-labelledby={`${id}-titulo`}>
      <div className={styles.titles}>
        <h2 id={`${id}-titulo`} className={styles.title}>
          Testar
        </h2>
        <p className={styles.hint}>Escreva como o cliente escreveria e veja qual produto o sistema entende.</p>
      </div>
      <label className={styles.search}>
        <Icon name="chat" size={18} />
        <span className="sr-only">Frase do cliente</span>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex.: quanto custa um aquecedor 20 litros com instalação?"
        />
      </label>
      {text.trim() !== '' && (
        <div aria-live="polite">
          {found.length === 0 ? (
            <p className={styles.none}>Nenhum produto encontrado. Cadastre o termo que o cliente usou.</p>
          ) : (
            <ul className={styles.results} aria-label="Produtos encontrados">
              {found.map((match) => (
                <li key={match.productId} className={styles.result}>
                  <span className={styles.product}>
                    <strong>{match.productCode}</strong> · {match.productDescription}
                  </span>
                  <span className={styles.term}>por “{match.term}”</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
